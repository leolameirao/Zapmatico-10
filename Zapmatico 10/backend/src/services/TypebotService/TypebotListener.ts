import { WAMessage, WASocket, delay } from "@whiskeysockets/baileys";
import { promisify } from "util";
import path, { join } from "path";
import fs, { writeFile, promises as fsPromises } from "fs";
import axios from "axios";
// import fs from "fs";

import { getMessageOptions } from "../WbotServices/SendWhatsAppMedia";
import { getBodyMessage } from "../WbotServices/wbotMessageListener";

import TicketTraking from "../../models/TicketTraking";
import Queue from "../../models/Queue";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag"


type Session = WASocket & {
  id?: number;
};

export const handleTypeBot = async (msg: WAMessage, wbot: Session, ticket: Ticket, ticketTraking: TicketTraking) => {

  const pathTypebot = path.resolve(__dirname, "..", "..", "..", "typebot");

  if (!fs.existsSync(pathTypebot)) {
    fs.mkdirSync(pathTypebot);
  }

  await ticketTraking.update({ inTypebot: true });

  // ao finalizar o ticket, excluir a sessão a fazer

  const sessionPath = path.resolve(__dirname, "..", "..", "..", "typebot", ticketTraking.id.toString(), "session.json");

  const publicFolder = path.resolve(__dirname, "..", "..", "..", "typebot", ticketTraking.id.toString());

  // verificar se a sessão ja esta aberta (se tem a pasta com o numero do chamado)

  if (fs.existsSync(publicFolder)) {

    try {
      const sessionId = await handleReadSession(sessionPath);

      const body = await getBodyMessage(msg);

      const data = {
        sessionId,
        message: body
      }

      const { messages, clientSideActions } = await handleContinueSession(sessionId, data, publicFolder);

      handleSendMessagesFromTypebot(messages, wbot, msg.key.remoteJid, ticket, publicFolder, clientSideActions);
    } catch (error) {
      await ticketTraking.update({ inTypebot: false });
    }


  } else {

    await fs.mkdirSync(publicFolder);

    // iniciar a conversa com o typebot
    try {
      var { data: { sessionId, messages, typebot, clientSideActions } } = await axios.post(`${process.env.TYPEBOT_URL}/${ticket.whatsapp.sessionName}/startChat`);

      handleCreateSession(sessionPath, sessionId)

      handleSendMessagesFromTypebot(messages, wbot, msg.key.remoteJid, ticket, publicFolder, clientSideActions);

    } catch (error) {
      console.log('error ao criar sessão do typebot', error);
      await ticketTraking.update({ inTypebot: false });
    }

  }

};

export const deleteDirectory = async (path: string) => {


  try {
    await fsPromises.rmdir(path, { recursive: true });
    console.log('Pasta excluída com sucesso!');
  } catch (error) {
    console.log('Erro ao excluir a pasta:', error);
  }

};

const writeFileAsync = promisify(writeFile);

const handleSendMessagesFromTypebot = async (messages, wbot, remoteJid, ticket, patth, clientSideActions) => {

  function findItemAndGetSecondsToWait(array, targetId) {
    if (!array) return null;

    for (const item of array) {
      if (item.lastBubbleBlockId === targetId) {
        return item.wait?.secondsToWaitFor;
      }
    }
    return null;
  }

  try {

    if (!messages) return;

    for (const message of messages) {

      const wait = findItemAndGetSecondsToWait(clientSideActions, message.id);

      if (message.type === 'text') {
        let formattedText = '';

        let linkPreview = false;

        for (const richText of message.content.richText) {

          if (richText.type === 'variable') {
            for (const child of richText.children) {
              for (const grandChild of child.children) {
                formattedText += grandChild.text;
              }
            }
          } else {
            for (const element of richText.children) {
              let text = '';

              if (element.type === 'inline-variable') {
                for (const child of element.children) {
                  for (const grandChild of child.children) {
                    text += grandChild.text;
                  }
                }
              } else if (element.text) {
                text = element.text;
              }

              // if (element.text) {
              //   text = element.text;
              // }

              if (element.bold) {
                text = `*${text}*`;
              }

              if (element.italic) {
                text = `_${text}_`;
              }

              if (element.underline) {
                text = `*${text}*`;
              }

              if (element.url) {
                const linkText = element.children[0].text;
                text = element.url;
                // text = `[${linkText}](${element.url})`;
                linkPreview = true;
              }

              formattedText += text;
            }
          }
          formattedText += '\n';
        }

        // formattedText = formattedText.replace(/\n$/, '');
        formattedText = formattedText.replace('**', '').replace(/\n$/, '');

        await wbot.sendPresenceUpdate('composing', remoteJid)


        const isAction = await handleVerifyActionFromTypebot(formattedText, ticket, patth);


        if (!isAction) {
          await wbot.sendMessage(
            `${remoteJid}`,
            {
              text: formattedText
            }
          );

          await delay(wait ? wait * 1000 : 1000)
          await wbot.sendPresenceUpdate('paused', remoteJid)
        }

      }

      if (message.type === 'audio') {
        await wbot.sendPresenceUpdate('composing', remoteJid)
        await delay(wait ? wait * 1000 : 1000)
        await wbot.sendPresenceUpdate('paused', remoteJid)
        const media = {
          audio: {
            url: message.content.url,
            mimetype: 'audio/mp4',
            ptt: true
          },
        }
        await wbot.sendMessage(remoteJid, media);

      }

      if (message.type === 'image') {
        await wbot.sendPresenceUpdate('composing', remoteJid)
        await delay(wait ? wait * 1000 : 1000)
        await wbot.sendPresenceUpdate('paused', remoteJid)
        const media = {
          image: {
            url: message.content.url,
          },

        }
        await wbot.sendMessage(remoteJid, media);
      }

      if (message.type === 'embed') {
        await wbot.sendPresenceUpdate('composing', remoteJid)
        await delay(wait ? wait * 1000 : 1000)
        await wbot.sendPresenceUpdate('paused', remoteJid);

        const media = await downloadExternalMedia(message.content.url);

        await writeFileAsync(
          join(patth, media?.filename),
          media.data,
          "base64"
        );

        const patthArchive = path.resolve(patth, media?.filename);

        const options = await getMessageOptions(media?.filename, patthArchive);

        await wbot.sendMessage(remoteJid, options);

      }

    }
  } catch (error) {
    console.log('error ao enviar mensagens do typebot', error)
  }
}

const downloadExternalMedia = async (url: string) => {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data, 'binary');
    const media = {
      data: imageBuffer,
      mimetype: response.headers['content-type'],
      filename: `${new Date().getTime()}.jpg`
    };
    return media;
  }
  catch (error) {
    console.error('Erro ao baixar a imagem:', error.message);
  }
};

const handleCreateSession = async (path: string, sessionId: string) => {

  await fsPromises.writeFile(path, JSON.stringify({ sessionId: sessionId }, null, 2));

}

const handleReadSession = async (path: string) => {

  try {
    let data = await fsPromises.readFile(path, 'utf-8');
    data = JSON.parse(data);

    // @ts-ignore
    return data?.sessionId;
  } catch (error) {
    console.log('error', error)
  }

};

const handleContinueSession = async (sessionId: string, data, path: string) => {

  try {

    const { data: { messages, clientSideActions } } = await axios.post(`${process.env.TYPEBOT_CONTINUE_CHAT}${sessionId}/continueChat`, data);

    return { messages, clientSideActions };

  } catch (error) {

    throw new Error("Erro ao continuar chat");

  }


}

const handleVerifyActionFromTypebot = async (msg, ticket: Ticket, path: string) => {

  // fazer as verificações se a fila / usuario pertence a empresa.
  const companyId = ticket.companyId;

  if (msg.startsWith("#queue=")) {

    const queues = await Queue.findAll({ where: { companyId } });
    let gatilhoQueue = msg.replace("#queue=", "");

    const fromThisCompany = queues.find((queue) => queue.id === parseInt(gatilhoQueue));

    if (!fromThisCompany) {
      throw new Error("Fila Escolhida no typebot não pertence a empresa");
    }

    let jsonGatilhoQueue = JSON.parse(gatilhoQueue);
    if (jsonGatilhoQueue && jsonGatilhoQueue > 0) {
      await UpdateTicketService({
        ticketData: {
          queueId: jsonGatilhoQueue,
          chatbot: false,
        },
        ticketId: ticket.id,
        companyId: ticket.companyId
      });
      return true;
    }

  }

  if (msg.startsWith("#user=")) {


    let gatilhoUser = msg.replace("#user=", "");

    const users = await User.findAll({ where: { companyId } });
    const fromThisCompany = users.find((user) => user.id === parseInt(gatilhoUser));

    if (!fromThisCompany) {
      throw new Error("Usuário Escolhido no typebot não pertence a empresa");
    }

    let jsonGatilhoUser = JSON.parse(gatilhoUser);
    if (jsonGatilhoUser && jsonGatilhoUser > 0) {
      await UpdateTicketService({
        ticketData: {
          status: "open",
          userId: jsonGatilhoUser,
          chatbot: false,
          // useIntegration: false,
          // integrationId: null
        },
        ticketId: ticket.id,
        companyId: ticket.companyId
      });

      return true;
    }

  }

  if (msg.startsWith("#close")) {

    await UpdateTicketService({
      ticketData: {
        status: "closed",
        queueId: null,
        userId: null
      },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    await deleteDirectory(path);

    return true;

  }



  if (/#\s*tag\s*=\s*/.test(msg)) {

    let gatilhoTag = msg.replace(/#\s*(tag)\s*=\s*/g, '');

    const tags = await Tag.findAll({ where: { companyId } });
    const fromThisCompany = tags.find((tag) => tag.id === parseInt(gatilhoTag));

    if (!fromThisCompany) {
      throw new Error("Tag Escolhida no typebot não pertence a empresa");
    }

    const tagsFromTicket = await TicketTag.findAll({ where: { ticketId: ticket.id } });

    const tagsId = tagsFromTicket.map((tag) => tag.tagId);

    let jsonGatilhoTag = JSON.parse(gatilhoTag);

    if (jsonGatilhoTag && jsonGatilhoTag > 0) {
      if (!tagsId.includes(jsonGatilhoTag)) {
        await TicketTag.create({ ticketId: ticket.id, tagId: jsonGatilhoTag });
      }
      return true;
    }



  }

  return false;

};
