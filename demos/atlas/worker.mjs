// Runs an import job off the main thread so a large file never freezes the page. The page cancels by terminating
// this worker, and starts a new one for the next job.
import {runJob} from './job.mjs';

self.onmessage = event => {
  try {
    runJob(event.data, message => self.postMessage(message));
  } catch (error) {
    self.postMessage({type: 'error', message: error instanceof Error ? error.message : String(error)});
  }
};
