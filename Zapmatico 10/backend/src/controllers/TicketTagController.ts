import { Request, Response } from "express";
import AppError from "../errors/AppError";
import TicketTag from '../models/TicketTag';
import Tag from '../models/Tag'

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId, tagId } = req.params;

  try {
    const ticketTag = await TicketTag.create({ ticketId, tagId });

    return res.status(201).json(ticketTag);

  } catch (error) {
    return res.status(500).json({ error: 'Failed to store ticket tag.' });
  }
};


export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;


  try {
    const ticketTags = await TicketTag.findAll({ where: { ticketId } });
    const tagIds = ticketTags.map((ticketTag) => ticketTag.tagId);

    const tagsWithKanbanOne = await Tag.findAll({
      where: {
        id: tagIds,
        kanban: 1,
      },
    });

    const tagIdsWithKanbanOne = tagsWithKanbanOne.map((tag) => tag.id);
    await TicketTag.destroy({ where: { ticketId, tagId: tagIdsWithKanbanOne } });

    return res.status(200).json({ message: 'Ticket tags removed successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to remove ticket tags.' });
  }
};