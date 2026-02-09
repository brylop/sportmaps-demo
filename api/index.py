import os
import sys

# Add the root directory to sys.path
path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if path not in sys.path:
    sys.path.append(path)

# Add the backend directory to sys.path so 'routes' can be imported directly
backend_path = os.path.join(path, 'backend')
if backend_path not in sys.path:
    sys.path.append(backend_path)

from backend.server import app
