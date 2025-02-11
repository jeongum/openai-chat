import { useState, useEffect, useRef } from "react";

const API_URL = "http://localhost:8080/api/chat"; // 실제 API 주소로 변경

const Chat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isComposing, setIsComposing] = useState(false); // ✅ 한글 입력 조합 중인지 확인하는 상태

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const sendMessage = () => {
    if (!input.trim() || isComposing) return; // 🚀 IME 입력 중일 때 전송하지 않음

    setMessages((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].text === input) {
        return prev; // 중복 방지
      }
      return [...prev, { role: "user", text: input }];
    });

    setInput("");
    setLoading(true);

    const eventSource = new EventSource(`${API_URL}?query=${encodeURIComponent(input)}`);

    let assistantText = "";
    eventSource.onmessage = (event) => {
      assistantText += event.data.replace(/^"|"$/g, '');

      setMessages((prev) => {
        if (prev.length === 0 || prev[prev.length - 1].role !== "assistant") {
          return [...prev, { role: "assistant", text: assistantText }];
        } else {
          return prev.map((msg, index) =>
            index === prev.length - 1 ? { ...msg, text: assistantText } : msg
          );
        }
      });

      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    };

    eventSource.onerror = () => {
      eventSource.close();
      setLoading(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    };
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, [messages]);

  return (
    <div className="flex flex-col max-w-lg mx-auto p-4 border rounded-lg shadow-md bg-white">
      <div className="h-80 overflow-y-auto border-b mb-4 p-2">
        {messages.map((msg, index) => (
          <div key={index} className={`mb-2 ${msg.role === "user" ? "text-right" : "text-left"}`}>
            <span className={`inline-block px-3 py-1 rounded-lg ${msg.role === "user" ? "bg-blue-500 text-white" : "bg-gray-200"}`}>
              {msg.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="flex">
        <input
          ref={inputRef}
          type="text"
          className="flex-grow p-2 border rounded-l-lg"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onCompositionStart={() => setIsComposing(true)} // 🚀 한글 입력 시작
          onCompositionEnd={() => setIsComposing(false)} // 🚀 한글 입력 완료
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isComposing) {
              sendMessage();
            }
          }}
        />
        <button className="p-2 bg-blue-500 text-white rounded-r-lg" onClick={sendMessage} disabled={loading}>
          {loading ? "응답 중..." : "전송"}
        </button>
      </div>
    </div>
  );
};

export default Chat;
