function serializeError(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    code: error?.code,
    data: error?.data,
    shortMessage: error?.shortMessage
  };
}

export async function executeWorkflow(workflow, runtime, initialContext = {}) {
  const context = {
    aliases: { ...(initialContext.aliases ?? {}) },
    values: { ...(initialContext.values ?? {}) },
    snapshots: { ...(initialContext.snapshots ?? {}) },
    deployments: { ...(initialContext.deployments ?? {}) },
    history: [...(initialContext.history ?? [])],
    checkpointSteps: { ...(initialContext.checkpointSteps ?? {}) }
  };
  const steps = [];

  for (let index = 0; index < workflow.steps.length; index += 1) {
    const step = workflow.steps[index];
    const startedAt = new Date().toISOString();
    try {
      const output = await runtime.execute(step, context, index);
      steps.push({
        index,
        action: step.action,
        label: step.label,
        status: 'completed',
        startedAt,
        finishedAt: new Date().toISOString(),
        output: output ?? null
      });
      if (step.action !== 'refork') {
        context.history.push(structuredClone(step));
        if (step.action === 'snapshot' && step.alias) {
          context.checkpointSteps[step.alias] = context.history.length;
        }
      }
    } catch (cause) {
      steps.push({
        index,
        action: step.action,
        label: step.label,
        status: 'failed',
        startedAt,
        finishedAt: new Date().toISOString(),
        error: serializeError(cause)
      });
      if (!step.continueOnFailure) {
        const failure = new Error(cause?.message ?? String(cause), { cause });
        failure.workflowSteps = steps;
        failure.workflowContext = context;
        throw failure;
      }
    }
  }

  return { steps, context };
}
