from model import llm
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage


#convesation + history 

history = [SystemMessage(content="Tu es un assistant utile et concis.")]

print("Chat NVIDIA — tape 'exit' ou 'quit' pour quitter.\n")

while True:
    user_input = input().strip()
    if user_input.lower() in {"exit", "quit"}:
        break
    if not user_input:
        continue

    history.append(HumanMessage(content=user_input))

    print("IA: ", end="")
    response = ""
    for chunk in llm.stream(history):
        print(chunk.content, end="")
        response += chunk.content
    print("\n")

    history.append(AIMessage(content=response))
