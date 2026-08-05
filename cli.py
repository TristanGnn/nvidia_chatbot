# cli.py
from main import stream

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