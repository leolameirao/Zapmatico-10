import React, { useContext, useState } from "react";
import {
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  makeStyles,
} from "@material-ui/core";

import { useHistory, useParams } from "react-router-dom";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useDate } from "../../hooks/useDate";
import Typography from '@material-ui/core/Typography';

import DeleteIcon from "@material-ui/icons/Delete";
import EditIcon from "@material-ui/icons/Edit";

import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    height: "calc(100% - 58px)",
    overflow: "hidden",
    borderRadius: 0,
  },
  chatList: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  listItem: {
    cursor: "pointer",
  },
  inline: {
    color: "white"
  }
}));

export default function ChatList({
  chats,
  handleSelectChat,
  handleDeleteChat,
  handleEditChat,
  pageInfo,
  loading,
}) {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const { datetimeToClient } = useDate();

  const [confirmationModal, setConfirmModalOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState({});

  const { id } = useParams();

  const goToMessages = async (chat) => {
    if (unreadMessages(chat) > 0) {
      try {
        await api.post(`/chats/${chat.id}/read`, { userId: user.id });
      } catch (err) { }
    }

    if (id !== chat.uuid) {
      history.push(`/chats/${chat.uuid}`);
      handleSelectChat(chat);
    }
  };

  const handleDelete = () => {
    handleDeleteChat(selectedChat);
  };

  const unreadMessages = (chat) => {
    const currentUser = chat.users.find((u) => u.userId === user.id);
    return currentUser.unreads;
  };

  const getPrimaryText = (chat) => {
    const mainText = chat.title;
    const unreads = unreadMessages(chat);
    return (
      <>
        {mainText}
        {unreads > 0 && (
          <Chip
            size="small"
            style={{ marginLeft: 5 }}
            label={unreads}
            color="secondary"
          />
        )}
      </>
    );
  };

  const getSecondaryText = (chat) => {
    return chat.lastMessage !== ""
      ? `${datetimeToClient(chat.updatedAt)}: ${chat.lastMessage}`
      : "";
  };

  const getItemStyle = (chat) => {
    return {
      borderLeft: chat.uuid === id ? "6px solid #002d6e" : null,
      backgroundColor: chat.uuid === id ? "#7f7f7f" : null,
    };
  };

  return (
    <>
      <ConfirmationModal
        title={"Excluir Conversa"}
        open={confirmationModal}
        onClose={setConfirmModalOpen}
        onConfirm={handleDelete}
      >
        Esta ação não pode ser revertida, confirmar?
      </ConfirmationModal>
      <div className={classes.mainContainer}>
        <div className={classes.chatList}>
          <List>
            {Array.isArray(chats) &&
              chats.length > 0 &&
              chats.map((chat, key) => (
                <ListItem
                  onClick={() => goToMessages(chat)}
                  key={key}
                  className={classes.listItem}
                  style={getItemStyle(chat)}
                  button
                >
                  <ListItemText
                    primary={
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          className={classes.inline}
                          color="textPrimary"
                        >
                          {getPrimaryText(chat)}
                        </Typography>
                      </>
                    }
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          className={classes.inline}
                          color="textPrimary"
                        >
                          {getSecondaryText(chat)}
                        </Typography>
                      </>
                    }
                  />

                  {chat.ownerId === user.id && (
                    <ListItemSecondaryAction>
                      <IconButton
                        onClick={() => {
                          goToMessages(chat).then(() => {
                            handleEditChat(chat);
                          });
                        }}
                        edge="end"
                        aria-label="delete"
                        size="small"
                        style={{ marginRight: 5, color: "white" }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        onClick={() => {
                          setSelectedChat(chat);
                          setConfirmModalOpen(true);
                        }}
                        edge="end"
                        aria-label="delete"
                        size="small"
                        style={{ color: "white" }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))}
          </List>
        </div>
      </div>
    </>
  );
}
