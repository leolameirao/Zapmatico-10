import React, { useState, createContext } from "react";

const ReplyMessageContext = createContext();

const ReplyMessageProvider = ({ children }) => {
	const [replyingMessage, setReplyingMessage] = useState(null);
	const [medias, setMedias] = useState([]);

	return (
		<ReplyMessageContext.Provider
			value={{ replyingMessage, setReplyingMessage, medias, setMedias }}
		>
			{children}
		</ReplyMessageContext.Provider>
	);
};

export { ReplyMessageContext, ReplyMessageProvider };
