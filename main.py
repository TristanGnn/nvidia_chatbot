from model import llm
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

SYSTEM = "Tu es un assistant utile et concis."

def build_messages(history=None):
    """[{'role': 'user'|'assistant', 'content': str}] -> messages LangChain"""
    msgs = [SystemMessage(content=SYSTEM)]
    for m in history or []:
        cls = HumanMessage if m["role"] == "user" else AIMessage
        msgs.append(cls(content=m["content"]))
    return msgs

def ask(message, history=None):
    """Réponse complète, en une fois. C'est ça que server.py importe."""
    msgs = build_messages(history)
    msgs.append(HumanMessage(content=message))
    return llm.invoke(msgs).content

def stream(message, history=None):
    """Même chose mais morceau par morceau (générateur)."""
    msgs = build_messages(history)
    msgs.append(HumanMessage(content=message))
    for chunk in llm.stream(msgs):
        yield chunk.content

def cli():
    history = []
    print("Chat NVIDIA — tape 'exit' ou 'quit' pour quitter.\n")
    while True:
        user_input = input("Vous: ").strip()
        if user_input.lower() in {"exit", "quit"}:
            break
        if not user_input:
            continue

        print("IA: ", end="")
        reply = ""
        for piece in stream(user_input, history):
            print(piece, end="", flush=True)
            reply += piece
        print("\n")

        history.append({"role": "user", "content": user_input})
        history.append({"role": "assistant", "content": reply})

if __name__ == "__main__":
    cli()