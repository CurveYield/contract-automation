import { CampaignService as InternalCampaignService } from './service.mjs';

export class CampaignService extends InternalCampaignService {
  async appendEventBatch(batch) {
    const result = await super.appendEventBatch(batch);
    return result?.batch ?? result;
  }

  async cancelJob(jobId, reason = 'cancelled') {
    const result = await super.cancelJob(jobId, reason);
    return result?.status ?? result;
  }

  async transitionJob(jobId, state) {
    const result = await super.transitionJob(jobId, state);
    return result?.status ?? result;
  }
}
