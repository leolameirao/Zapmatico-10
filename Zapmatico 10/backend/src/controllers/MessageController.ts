import { Request, Response } from "express";
import AppError from "../errors/AppError";

import SetTicketMessagesAsRead from "../helpers/SetTicketMessagesAsRead";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";
import QuickMessage from "../models/QuickMessage";
import fs from 'fs';
import path from "path";
import { Readable } from 'stream';
import { lookup } from 'mime-types';
import { getMessageOptions } from "../services/WbotServices/SendWhatsAppMedia";

import ListMessagesService from "../services/MessageServices/ListMessagesService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import DeleteWhatsAppMessage from "../services/WbotServices/DeleteWhatsAppMessage";
import SendWhatsAppMedia from "../services/WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../services/WbotServices/SendWhatsAppMessage";
import CheckContactNumber from "../services/WbotServices/CheckNumber";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";

import { sendFacebookMessageMedia } from "../services/FacebookServices/sendFacebookMessageMedia";
import sendFaceMessage from "../services/FacebookServices/sendFacebookMessage";

import Contact from "../models/Contact";
import CreateOrUpdateContactService from "../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../services/TicketServices/FindOrCreateTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import formatBody from "../helpers/Mustache";

type IndexQuery = {
  pageNumber: string;
};

type MessageData = {
  body: string;
  fromMe: boolean;
  read: boolean;
  quotedMsg?: Message;
  number?: string;
  isComment?: boolean;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { pageNumber } = req.query as IndexQuery;
  const { companyId, profile } = req.user;
  const queues: number[] = [];

  if (profile !== "admin") {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Queue, as: "queues" }]
    });
    user.queues.forEach(queue => {
      queues.push(queue.id);
    });
  }

  const { count, messages, ticket, hasMore } = await ListMessagesService({
    pageNumber,
    ticketId,
    companyId,
    queues
  });

  if (ticket.channel === "whatsapp") {
    SetTicketMessagesAsRead(ticket);
  }

  return res.json({ count, messages, ticket, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { body, quotedMsg, isComment }: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];
  const { companyId } = req.user;

  const ticket = await ShowTicketService(ticketId, companyId);


  const pattern = /^\s*\[(.*?)\]$/;
  const patternB = /\s*\*.*?\*/g;

  const checaQuick = body.replace(patternB, '');
  const matches = pattern.test(checaQuick);

  if (matches) {

    const extractedValue = pattern.exec(checaQuick)?.[1];
    //console.log(extractedValue);

    try {
      const quickMessage = await QuickMessage.findOne({
        where: {
          shortcode: extractedValue,
          companyId: companyId,
          userId: req.user.id,
        },
      });

      if (quickMessage) {
        const { mediaPath, mediaName } = quickMessage;

        //const filePath = path.resolve(`public/company${companyId}`, mediaPath);
        //const mediaX = await getMessageOptions(mediaName, filePath, companyId.toString());

        //console.log(media);



        const publicFolder = path.resolve(__dirname, "..", "..", "..", "backend/public");
        console.log(publicFolder);
        const filePath: string = `${publicFolder}/${mediaPath}`;
        console.log(filePath);
        const mimeType: string = lookup(filePath);
        console.log(mimeType);
        const fileData: Buffer = fs.readFileSync(filePath);
        const fileStream = fs.createReadStream(filePath);
        const media: Express.Multer.File = {
          fieldname: 'medias', // Add the appropriate value
          originalname: mediaName, // Add the appropriate value
          encoding: '7bit', // Add the appropriate value
          mimetype: mimeType, // Add the appropriate value
          destination: publicFolder, // Add the appropriate value
          filename: mediaPath,
          path: filePath,
          size: fileData.length,
          buffer: Buffer.alloc(0), // Provide an empty buffer since the file is streamed
          stream: fileStream
        };
        //console.log(media);


        const senting = SendWhatsAppMedia({ media, ticket });
        //console.log(senting);

        return res.send();
        //await SendWhatsAppMedia({ media, ticket });
      }
    } catch (error) {
      console.error("Error checking shortcode:", error);
      return null;
    }

  }


  const { channel } = ticket;
  if (channel === "whatsapp") {
    SetTicketMessagesAsRead(ticket);
  }

  if (medias) {
    if (channel === "whatsapp") {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await SendWhatsAppMedia({ media, ticket });
        })
      );
    }

    if (["facebook", "instagram"].includes(channel)) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await sendFacebookMessageMedia({ media, ticket });
        })
      );
    }


  } else {


    if (isComment && !medias) {
      const generateRandomId = "COMMENT_" + Math.random().toString(36).substring(2, 14) + Math.random().toString(36).substring(2, 14);
      const randomId = generateRandomId.toUpperCase();
      const messageData = {
        id: randomId,
        ticketId: ticket.id,
        contactId: ticket.contact.id,
        body,
        fromMe: true,
        mediaType: "conversation",
        read: true,
        quotedMsgId: quotedMsg?.id,
        ack: 3,
        isComment: true
      };

      await CreateMessageService({ messageData, companyId: ticket.companyId });

      await ticket.update({ lastMessage: formatBody(body, ticket.contact) });
    } else {

      if (["facebook", "instagram"].includes(channel)) {
        console.log(`Checking if ${ticket.contact.number} is a valid ${channel} contact`)
        await sendFaceMessage({ body, ticket, quotedMsg });
      }

      if (channel === "whatsapp") {
        await SendWhatsAppMessage({ body, ticket, quotedMsg });
      }

    }

  }

  return res.send();
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { messageId } = req.params;
  const { companyId } = req.user;

  const message = await DeleteWhatsAppMessage(messageId);

  const io = getIO();
  io.to(message.ticketId.toString()).emit(`company-${companyId}-appMessage`, {
    action: "update",
    message
  });

  return res.send();
};

export const send = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params as unknown as { whatsappId: number };
  const messageData: MessageData = req.body;
  const medias = req.files as Express.Multer.File[];

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);

    if (!whatsapp) {
      throw new Error("Não foi possível realizar a operação");
    }

    if (messageData.number === undefined) {
      throw new Error("O número é obrigatório");
    }

    const numberToTest = messageData.number;
    const body = messageData.body;

    const companyId = whatsapp.companyId;

    const CheckValidNumber = await CheckContactNumber(numberToTest, companyId);
    const number = CheckValidNumber.jid.replace(/\D/g, "");

    if (medias) {
      await Promise.all(
        medias.map(async (media: Express.Multer.File) => {
          await req.app.get("queues").messageQueue.add(
            "SendMessage",
            {
              whatsappId,
              data: {
                number,
                body: media.originalname,
                mediaPath: media.path
              }
            },
            { removeOnComplete: true, attempts: 3 }
          );
        })
      );
    } else {

      req.app.get("queues").messageQueue.add(
        "SendMessage",
        {
          whatsappId,
          data: {
            number,
            body
          }
        },

        { removeOnComplete: false, attempts: 3 }

      );
    }

    return res.send({ mensagem: "Mensagem enviada" });
  } catch (err: any) {
    if (Object.keys(err).length === 0) {
      throw new AppError(
        "Não foi possível enviar a mensagem, tente novamente em alguns instantes"
      );
    } else {
      throw new AppError(err.message);
    }
  }
};
