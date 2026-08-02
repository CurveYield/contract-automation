import { GanacheWorkflowRuntime } from './engine.mjs';
import {
  advanceToBlock,
  mineBlocks,
  mineUntilTimestamp,
  setAutomine,
  setIntervalMining,
  setNextTimestamp
} from './live-fork-time.mjs';

export class LiveForkWorkflowRuntime extends GanacheWorkflowRuntime {
  constructor({ provider, artifacts, ethers, reforkHandler, engineName = 'local-fork' }) {
    super({ provider, artifacts, ethers });
    this.reforkHandler = reforkHandler;
    this.engineName = engineName;
  }

  async execute(step, context) {
    switch (step.action) {
      case 'mine': return mineBlocks(this.provider, step);
      case 'setNextBlockTimestamp': return this.setNextBlockTimestamp(step);
      case 'mineAtTimestamp': return this.mineAtTimestamp(step);
      case 'mineUntilTimestamp': return mineUntilTimestamp(this.provider, step);
      case 'advanceToBlock': return advanceToBlock(this.provider, step);
      case 'setAutomine': return setAutomine(this.provider, step.enabled);
      case 'setIntervalMining': return setIntervalMining(this.provider, step.intervalMilliseconds);
      case 'refork': return this.refork(step, context);
      default: return super.execute(step, context);
    }
  }

  async setNextBlockTimestamp(step) {
    const method = await setNextTimestamp(this.provider, step.timestamp);
    return { timestamp: step.timestamp, method };
  }

  async mineAtTimestamp(step) {
    const method = await setNextTimestamp(this.provider, step.timestamp);
    await this.provider.send('evm_mine', []);
    return { timestamp: step.timestamp, method, blocks: 1 };
  }

  async refork(step, context) {
    if (typeof this.reforkHandler !== 'function') {
      throw new Error(`${this.engineName} does not support refork`);
    }
    return this.reforkHandler(step, context);
  }
}
