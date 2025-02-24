import Queue from "bull";

const transcriptionQueue = new Queue("audioTranscription", process.env.REDIS_URI);

export const addTranscriptionJob = (audioPath: string, messageId: string, companyId: string) => {
  transcriptionQueue.add({ audioPath, messageId, companyId });
};
