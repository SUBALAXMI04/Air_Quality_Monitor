from flask import Flask, jsonify, request

from predict import predict_from_saved_model

app = Flask(__name__)


@app.route("/predict", methods=["POST"])
def predict():
    payload = request.get_json(silent=True)
    if payload is None:
        return jsonify({"error": "Invalid JSON payload."}), 400

    try:
        predictions = predict_from_saved_model(payload)
        return jsonify({"predictions": predictions}), 200
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except FileNotFoundError as exc:
        return jsonify({"error": f"Model file not found: {exc}"}), 500
    except Exception as exc:
        return jsonify({"error": f"Unexpected error: {exc}"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
