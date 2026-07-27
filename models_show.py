from langchain_nvidia_ai_endpoints import ChatNVIDIA

for model in ChatNVIDIA.get_available_models():
    print(model.id)