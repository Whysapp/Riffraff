# Stems service

## Setup
```bash
pip install -r requirements.txt
# If you have CUDA, install matching torch wheel
```

## Start service
```bash
uvicorn app:app --host 0.0.0.0 --port 8001
```

The service will be available at http://localhost:8001/separate