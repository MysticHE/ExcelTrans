import os
from flask import Flask
from flask_cors import CORS
from extensions import limiter
from intelligence import intel_bp

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50 MB upload limit

ALLOWED_ORIGINS = [
    'https://exceltrans-frontend.onrender.com',
    'http://localhost:3000',
]

CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

limiter.init_app(app)

app.register_blueprint(intel_bp)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
