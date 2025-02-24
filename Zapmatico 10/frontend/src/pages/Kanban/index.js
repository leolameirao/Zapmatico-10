import React, { useState, useEffect, useReducer, useContext, useCallback } from "react";
import { makeStyles } from "@material-ui/core/styles";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import Board from 'react-trello';
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import { useHistory } from 'react-router-dom';
import { socketConnection } from "../../services/socket";
import toastError from "../../errors/toastError";

/*


CÓDIGO DESENVOLVIDO POR RAFAEL RIBEIRO
PROÍBIDA A VENDA TOTAL OU PARCIAL DESTE CÓDIGO
CONTATO: HELP@WHATICKET-SAAS.COM
TELEFONE: +55 51 9323-1592


*/


const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    alignItems: "center",
    padding: theme.spacing(1),
    overflowY: "hidden",
  },

  button: {
    background: "#10a110",
    border: "none",
    padding: "10px",
    color: "white",
    fontWeight: "bold",
    borderRadius: "5px",
  },

}));



const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();

  const [tags, setTags] = useState([]);
  const [reloadData, setReloadData] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);
  const [file, setFile] = useState({ lanes: [] });
  const [tickets, setTickets] = useState([]);
  const { user } = useContext(AuthContext);
  const { profile, queues } = user;
  const jsonString = user.queues.map(queue => queue.UserQueue.queueId);



  useEffect(() => {
    popularCards(jsonString);
  }, [tags, tickets, reloadData]);

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const response = await api.get("/tags/kanban");
      const fetchedTags = response.data.lista || [];
      //console.log(response);
      setTags(fetchedTags);

      // Fetch tickets after fetching tags
      await fetchTickets(jsonString);
    } catch (error) {
      console.log(error);
    }
  };

  const fetchTickets = async (jsonString) => {
    try {
      const { data } = await api.get("/tickets/kanban", {
        params: {
          queueIds: JSON.stringify(jsonString),
          teste: true
        }
      });
      setTickets(data.tickets);
    } catch (err) {
      console.log(err);
      setTickets([]);
    }
  };

  const handleCardClick = (uuid) => {
    //console.log("Clicked on card with UUID:", uuid);
    history.push('/tickets/' + uuid);
  };

  const handleCardMove = async (cardId, sourceLaneId, targetLaneId) => {
    try {

      await api.delete(`/ticket-tags/${targetLaneId}`);
      toast.success('Ticket Tag Removido!');
      await api.put(`/ticket-tags/${targetLaneId}/${sourceLaneId}`);
      toast.success('Ticket Tag Adicionado com Sucesso!');

    } catch (err) {
      console.log(err);
    }
  };

  const popularCards = (jsonString) => {
    const ticketsNaoAgrupados = tickets.filter(ticket => ticket.tags.length === 0 && !ticket.isGroup);

    const tagsOrdenadas = tags.sort((a, b) => a.position - b.position);

    const lanes = [
      {
        id: "lane0",
        title: "Em Aberto",
        style: {
          maxHeight: '80vh',
        },
        cards: ticketsNaoAgrupados.map(ticket => ({
          id: ticket.id.toString(),
          label: "Ticket nº " + ticket.id.toString(),
          description: (
            <div>
              <p>
                {ticket.contact.number}
                <br />
                {ticket.lastMessage}
              </p>
              <button className={classes.button} onClick={() => handleCardClick(ticket.uuid)}>Ver Ticket</button>
            </div>
          ),
          title: ticket.contact.name,
          draggable: true,
          href: "/tickets/" + ticket.uuid,
        })),

      },
      ...tagsOrdenadas.map(tag => {
        const ticketsFiltrados = tickets.filter(ticket => {
          const tagIds = ticket.tags.map(tag => tag.id);
          return tagIds.includes(tag.id);
        });

        return {
          id: tag.id.toString(),
          title: tag.name,
          cards: ticketsFiltrados.map(ticket => ({
            id: ticket.id.toString(),
            label: "Ticket nº " + ticket.id.toString(),
            description: (
              <div>
                <p>
                  {ticket.contact.number}
                  <br />
                  {ticket.lastMessage}
                </p>
                <button className={classes.button} onClick={() => handleCardClick(ticket.uuid)}>Ver Ticket</button>
              </div>
            ),
            title: ticket.contact.name,
            draggable: true,
            href: "/tickets/" + ticket.uuid,
          })),
          style: { maxHeight: '80vh', backgroundColor: tag.color, color: "white" }
        };
      }),
    ];

    setFile({ lanes });
  };

  const handleUpdateLanes = async (data) => {
    try {

      const { data: response } = await api.put("/tags/kanban", data);

    } catch (error) {
      toastError('Falha ao alterar posições das lanes');
    }
  }



  return (
    <div className={classes.root}>
      <Board
        data={file}

        handleLaneDragEnd={(board, sourceLaneId, targetLaneId) => {

          const currentOrder = file.lanes;

          function moverObjeto(antigoIndex, novoIndex) {

            const objetoMovido = currentOrder.splice(antigoIndex, 1)[0];
            currentOrder.splice(novoIndex, 0, objetoMovido);
            return currentOrder;
          }

          const newOrder = moverObjeto(board, sourceLaneId);

          handleUpdateLanes(newOrder);
        }}
        onCardMoveAcrossLanes={handleCardMove}
        style={{ height: '90vh', backgroundColor: 'rgba(252, 252, 252, 0.03)' }}
        draggable={true}
      />
    </div>
  );
};


export default Kanban;