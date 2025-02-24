import Queue from "bull";
import OpenAI from "openai";
import fs from "fs";
import Message from "../models/Message";
import { getIO } from "../libs/socket";
import Setting from "../models/Setting";


const connection = process.env.REDIS_URI;

const transcriptionQueue = new Queue("audioTranscription", connection);

transcriptionQueue.process(async job => {

  const { audioPath, messageId, companyId } = job.data;

  const key = await Setting.findOne({
    where: {
      companyId,
      key: "openAIToken"
    }
  });

  const openAI = new OpenAI({
    apiKey: key.value,
  });

  try {

    const audioStream = fs.createReadStream(audioPath);

    const transcription = await openAI.audio.transcriptions.create({
      file: audioStream,
      model: 'whisper-1',
    });

    const msg = await Message.findOne({
      where: {
        id: messageId
      }
    });


    if (msg) {

      msg.body = transcription.text;
      await msg.save();

      const io = getIO();

      io.to(msg.ticketId.toString())
        .emit(`company-${msg.companyId}-appMessage`, {
          action: "update",
          message: msg,
        });


    }

  } catch (error) {
    console.error(error);
  }

});

transcriptionQueue.on("completed", (job) => {
  console.log(`🎉 Job ${job.id} finalizado!`);
});

transcriptionQueue.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} falhou:`, err);
});

console.log("🚀 Worker iniciado e ouvindo a fila...");
