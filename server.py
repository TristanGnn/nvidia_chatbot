from flask import Flask, request, jsonify, Response, stream_with_context
import main as main

app = Flask(__name__, static_folder="static", static_url_path="")


@app.route("/")
def index():
    return app.send_static_file("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    message = data.get("message")
    history = data.get("history", [])
    if not message:
        return jsonify({"error": "Message is required"}), 400

    # [:-1] : app.js a déjà poussé le message courant dans l'historique,
    # sans ça le modèle recevrait la question deux fois
    reply = main.ask(message, history[:-1])
    return jsonify({"reply": reply})


@app.route("/api/chat/stream", methods=["POST"])
def chat_stream():
    data = request.get_json()
    message = data.get("message")
    history = data.get("history", [])
    if not message:
        return jsonify({"error": "Message is required"}), 400

    def generate():
        for piece in main.stream(message, history[:-1]):
            yield piece

    return Response(
        stream_with_context(generate()),
        mimetype="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # empêche nginx de tamponner le flux
        },
    )


if __name__ == "__main__":
    app.run(debug=True)