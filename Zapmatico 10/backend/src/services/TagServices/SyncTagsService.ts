import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";

interface Request {
  tags: Tag[];
  ticketId: number;
}

const SyncTags = async ({
  tags,
  ticketId
}: Request): Promise<Ticket | null> => {
  const io = getIO();
  const ticket = await Ticket.findByPk(ticketId, { include: [Tag] });
  const companyId = ticket?.companyId;

  const tagList = tags.map(t => ({ tagId: t.id, ticketId }));

  await TicketTag.destroy({ where: { ticketId } });
  await TicketTag.bulkCreate(tagList);

  const ticketReturn = await Ticket.findByPk(ticketId, { include: [Tag, Contact] });

  ticket?.reload();

  io.to(ticket.status)
    .to("notification")
    .to(ticketId.toString())
    .emit(`company-${companyId}-ticket`, {
      action: "tagUpdate",
      ticket: ticketReturn
    });

  return ticket;
};

export default SyncTags;
