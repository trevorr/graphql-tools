import { getOperationAST } from 'graphql';

import isPromise from 'is-promise';

import DataLoader from 'dataloader';

import { ExecutionResult, isAsyncIterable } from '@graphql-tools/utils';

import { ExecutionParams, Endpoint, Executor } from './types';
import { memoize2of3 } from './memoize';
import { mergeExecutionParams } from './mergeExecutionParams';
import { splitResult } from './splitResult';

export const getBatchingExecutor = memoize2of3(function (
  _context: Record<string, any>,
  endpoint: Endpoint,
  executor: Executor
) {
  const loader = new DataLoader(
    createLoadFn(
      executor ?? endpoint.executor,
      endpoint.batchingOptions?.extensionsReducer ?? defaultExtensionsReducer
    ),
    endpoint.batchingOptions?.dataLoaderOptions
  );
  return (executionParams: ExecutionParams) => loader.load(executionParams);
});

function createLoadFn(
  executor: Executor,
  extensionsReducer: (mergedExtensions: Record<string, any>, executionParams: ExecutionParams) => Record<string, any>
) {
  return async (execs: Array<ExecutionParams>): Promise<Array<ExecutionResult>> => {
    const execBatches: Array<Array<ExecutionParams>> = [];
    let index = 0;
    const exec = execs[index];
    let currentBatch: Array<ExecutionParams> = [exec];
    execBatches.push(currentBatch);
    const operationType = getOperationAST(exec.document, undefined).operation;
    while (++index < execs.length) {
      const currentOperationType = getOperationAST(execs[index].document, undefined).operation;
      if (operationType === currentOperationType) {
        currentBatch.push(execs[index]);
      } else {
        currentBatch = [execs[index]];
        execBatches.push(currentBatch);
      }
    }

    let containsPromises = false;
    const executionResults: Array<ExecutionResult | Promise<ExecutionResult>> = [];
    execBatches.forEach(execBatch => {
      const mergedExecutionParams = mergeExecutionParams(execBatch, extensionsReducer);
      const executionResult = executor(mergedExecutionParams);

      if (isAsyncIterable(executionResult)) {
        throw new Error('batching not yet possible with queries that return an async iterable (defer/stream)');
        // requires splitting up the async iterable into multiple async iterables by path versus possibly just promises
        // so requires analyzing which of the results would get an async iterable (ie included defer/stream within the subdocument)
        // or returning an async iterable even though defer/stream was not actually present, which is probably simpler
        // but most probably against the spec.
      } else if (isPromise(executionResult)) {
        containsPromises = true;
      }
      executionResults.push(executionResult as ExecutionResult);
    });

    if (containsPromises) {
      return Promise.all(executionResults).then(resultBatches => {
        let results: Array<ExecutionResult> = [];
        resultBatches.forEach((resultBatch, index) => {
          results = results.concat(splitResult(resultBatch, execBatches[index].length));
        });
        return results;
      });
    }

    let results: Array<ExecutionResult> = [];
    (executionResults as Array<ExecutionResult>).forEach((resultBatch, index) => {
      results = results.concat(splitResult(resultBatch, execBatches[index].length));
    });
    return results;
  };
}

function defaultExtensionsReducer(
  mergedExtensions: Record<string, any>,
  executionParams: ExecutionParams
): Record<string, any> {
  const newExtensions = executionParams.extensions;
  if (newExtensions != null) {
    Object.assign(mergedExtensions, newExtensions);
  }
  return mergedExtensions;
}
