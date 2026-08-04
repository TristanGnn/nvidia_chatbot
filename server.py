from flask import Flask, request, jsonify
import main

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

    reply = main.ask(message, history)
    return jsonify({"reply": reply})

if __name__ == "__main__":
    app.run(debug=True)