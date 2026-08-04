from flask import Flask, request, jsonify
import main 
app = Flask(__name__)

@app.route("/")
def index():
    
    return "Hello, World!"

if __name__ == "__main__":
    app.run(debug=True)
 
