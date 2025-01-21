"use client";

import { useRef, useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { ChatCompletionStream } from "together-ai/lib/ChatCompletionStream";
import LoadingDots from "./components/LoadingDots";
import { PlusIcon, ChatBubbleLeftIcon } from "@heroicons/react/24/outline";

type MessageRole = "user" | "assistant" | "system";

interface Message {
  role: MessageRole;
  content: string;
  timestamp?: Date;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const createRickPrompt = (userInput: string): string => {
  return `You are Rick from Rick and Morty. Respond to the following message in Rick's characteristic style, complete with his mannerisms, catchphrases, and attitude. Be sarcastic, scientific, and occasionally burp (use *burp* in text). Keep responses under 200 words.

User message: ${userInput}

Rick's response:`;
};

const handleError = (error: Error): void => {
  console.error("Error:", error);
  toast.error("Something went wrong. Please try again.");
};

export default function Home() {
  const [loading, setLoading] = useState<boolean>(false);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [userInput, setUserInput] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedChats = localStorage.getItem("chats");
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats);
      const convertedChats = parsedChats.map((chat: Chat) => ({
        ...chat,
        createdAt: new Date(chat.createdAt),
      }));
      setChats(convertedChats);
      // Set the most recent chat as active if there are any chats
      if (convertedChats.length > 0) {
        setActiveChat(convertedChats[convertedChats.length - 1]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("chats", JSON.stringify(chats));
  }, [chats]);

  // Modified createNewChat function
  const createNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: `New Chat ${chats.length + 1}`,
      messages: [],
      createdAt: new Date(),
    };
    setChats((prev) => [...prev, newChat]);
    setActiveChat(newChat); // Set the new chat as active immediately
  };

  // Modified updateChat function
  const updateChat = (chatId: string, messages: Message[]) => {
    const updatedChats = chats.map((chat) =>
      chat.id === chatId
        ? {
            ...chat,
            title: messages[0]?.content.slice(0, 30) || chat.title,
            messages,
          }
        : chat
    );
    setChats(updatedChats);

    // Update activeChat as well to ensure immediate UI update
    const updatedActiveChat = updatedChats.find((chat) => chat.id === chatId);
    if (updatedActiveChat) {
      setActiveChat(updatedActiveChat);
    }
  };

  const scrollToBottom = (): void => {
    if (chatRef.current) {
      chatRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // If there's no active chat, automatically create one
  // useEffect(() => {
  //   if (chats.length === 0) {
  //     createNewChat();
  //   }
  // }, []);

  const sendMessage = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!userInput.trim()) return;

    // If there's no active chat, create one
    if (!activeChat) {
      createNewChat();
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const newMessage: Message = {
        role: "user",
        content: userInput,
        timestamp: new Date(),
      };

      const updatedMessages = [...activeChat.messages, newMessage];
      updateChat(activeChat.id, updatedMessages);
      setUserInput("");

      const response = await fetch("/api/together", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: createRickPrompt(userInput),
          model: "mistralai/Mixtral-8x7B-Instruct-v0.1",
        }),
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      let rickResponse = "";
      const runner = ChatCompletionStream.fromReadableStream(response.body!);

      runner.on("content", (delta: string) => {
        rickResponse += delta;
        const messagesWithResponse: Message[] = [
          ...updatedMessages,
          {
            role: "assistant" as MessageRole,
            content: rickResponse,
            timestamp: new Date(),
          },
        ];
        updateChat(activeChat.id, messagesWithResponse);
        scrollToBottom();
      });
    } catch (err) {
      handleError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  // Rest of the JSX remains the same...
  return (
    <div className="flex h-screen bg-[#262626]">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } bg-[#1a1a1a] transition-all duration-300 overflow-hidden`}
      >
        <div className="p-4">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center space-x-2 bg-green-500 text-white p-2 rounded-lg hover:bg-green-600"
          >
            <PlusIcon className="h-5 w-5" />
            <span>New Chat</span>
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100vh-5rem)]">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveChat(chat)}
              className={`p-3 cursor-pointer hover:bg-gray-800 flex items-center space-x-2 ${
                activeChat?.id === chat.id ? "bg-gray-800" : ""
              }`}
            >
              <ChatBubbleLeftIcon className="h-5 w-5 text-green-400" />
              <div className="flex-1 truncate text-white">{chat.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-gray-700 flex items-center">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-white mr-4"
          >
            ☰
          </button>
          <h1 className="text-2xl font-bold text-green-400">
            {activeChat ? activeChat.title : "Select or Create a Chat"}
          </h1>
        </div>

        {activeChat ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeChat.messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === "user"
                        ? "bg-blue-600 text-white"
                        : "bg-green-500 text-white"
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    {message.timestamp && (
                      <span className="text-xs opacity-70">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatRef} />
            </div>

            <form
              onSubmit={sendMessage}
              className="p-4 border-t border-gray-700"
            >
              <div className="flex space-x-4">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="flex-1 rounded-lg p-2 bg-gray-800 text-white border border-gray-600 focus:border-green-400 focus:ring-0"
                  placeholder="Talk to Rick..."
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <LoadingDots color="white" style="large" />
                  ) : (
                    "Send"
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-white">
            Select a chat from the sidebar or create a new one
          </div>
        )}
      </div>
      <Toaster position="top-center" />
    </div>
  );
}
