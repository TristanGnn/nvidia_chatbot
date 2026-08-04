# temp_server.py — jetable, à supprimer après le test
from flask import Flask, request, jsonify
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from model import llm                      # model.py est sûr : aucune boucle dedans

app = Flask(__name__, static_folder="static", static_url_path="")

@app.get("/")
def index():
    return app.send_static_file("index.html")

@app.post("/api/chat")
def chat():
    data = request.get_json()

    msgs = [SystemMessage(content="Tu es un assistant utile et concis.")]
    # [:-1] : app.js a déjà poussé le message courant dans l'historique
    for m in data.get("history", [])[:-1]:
        cls = HumanMessage if m["role"] == "user" else AIMessage
        msgs.append(cls(content=m["content"]))
    msgs.append(HumanMessage(content=data["message"]))

    return jsonify({"reply": llm.invoke(msgs).content})

app.run(host="0.0.0.0", port=5000)