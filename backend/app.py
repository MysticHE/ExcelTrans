import os
from flask import Flask
from flask_cors import CORS
from intelligence import intel_bp

app = Flask(__name__)

# Allow requests from any origin (frontend on GitHub Pages / Render Static)
CORS(app, resources={r"/api/*": {"origins": "*"}})

app.register_blueprint(intel_bp)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
