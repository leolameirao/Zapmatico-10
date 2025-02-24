import Tag from "../../models/Tag";



export const UpdatePositionKanbanServices = async (data: []): Promise<void> => {

  data.map(async (item: any, index) => {


    if (item.id === 'lane0') return

    const tag = await Tag.findByPk(item.id);

    if (!tag) return;

    await tag.update({ position: index });


  });

}