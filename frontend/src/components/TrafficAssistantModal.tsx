import React, { useState } from "react";
import { askAssistant } from "../api";
import { MessageSquare, Send, Sparkles, X, Bot, User, CheckCircle2 } from "lucide-react";

interface TrafficAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: any;
}

interface ChatMessage {
  sender: "user" | "assistant";
  text: string;
  provider?: string;
  time: string;
}

export const TrafficAssistantModal: React.FC<TrafficAssistantModalProps> = ({
  isOpen,
  onClose,
  context,
}) => {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      sender: "assistant",
      text: `Hello! I am your **TrafficPulse AI Assistant**. I am actively monitoring telemetry for **${
        context?.road_name || "selected corridors"
      }** in **${context?.city || "Bengaluru"}**.\n\nAsk me about current congestion drivers, multi-horizon predictions, citywide bottleneck comparisons, or adaptive signal simulations.`,
      provider: "TrafficPulse Grounded Intelligence",
      time: "Just now",
    },
  ]);

  if (!isOpen) return null;

  const quickPrompts = [
    "How does this time of day affect traffic congestion?",
    "What effect do festivals like Diwali or Ganesh Chaturthi have on this road?",
    "How does rain and adverse weather impact travel speeds here?",
    "Why is this road highly congested right now?",
    "What factors influenced this forecast prediction?",
  ];

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      sender: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const resp = await askAssistant(textToSend, context);
      const assistantMsg: ChatMessage = {
        sender: "assistant",
        text: resp.answer,
        provider: resp.provider,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: "I encountered an error querying the intelligence engine. Please try again.",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl h-[600px] flex flex-col bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                TrafficPulse AI Assistant
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-normal">
                  Grounded in Telemetry
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Active Corridor: <span className="text-cyan-300 font-medium">{context?.road_name}</span> ({context?.city})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Prompts */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" /> Prompts:
          </span>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              disabled={loading}
              className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded bg-slate-800/80 hover:bg-cyan-950/80 hover:text-cyan-300 hover:border-cyan-700/60 text-slate-300 border border-slate-700 transition cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2.5 ${m.sender === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  m.sender === "user"
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-800 text-cyan-400 border border-slate-700"
                }`}
              >
                {m.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[82%] rounded-xl px-3.5 py-2.5 text-xs ${
                  m.sender === "user"
                    ? "bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                    : "bg-slate-950/90 border border-slate-800 text-slate-200"
                }`}
              >
                <div className="whitespace-pre-line leading-relaxed font-sans">{m.text}</div>
                <div className="mt-1 flex items-center justify-between gap-3 text-[10px] opacity-70">
                  <span>{m.provider || ""}</span>
                  <span>{m.time}</span>
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 italic py-1">
              <Bot className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Analyzing live telemetry and model forecast outputs...</span>
            </div>
          )}
        </div>

        {/* Input Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
            placeholder="Ask about traffic patterns, speeds, signal impact..."
            disabled={loading}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={() => handleSend(input)}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.4)]"
          >
            <Send className="w-3.5 h-3.5" /> Send
          </button>
        </div>
      </div>
    </div>
  );
};
