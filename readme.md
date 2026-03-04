# Project template for AI Apps

This is the fundamental structure of how the application we create in the course should look.

In the root there should only be two folders:
- frontend
- backend

In the frontend you will have you react and build your react components used for the course.

In the backend your API will live and the overall orchestration of AI models will be here.

In the root of the backend folder there should be:
- agents
  - tools
- evals
- models (folder)
- test (folder)
- tools (folder)
- requirements.txt
- main.py

This is the overall structure that your project as a minimum should have.
**agents:** All agents are stored in this folder as separate classes.
**agents/tools:** All custom tools available for the agents are stored here. Each tool has its own class.
**models:** Here you store your pydantic models used for input and output for FastAPI.
**test:** Here you store all unittest
**tools:** Here you store all your function and modules that have an overall function for you program.
**requirements.txt:** Your dependencies are listed here. Crucial to keep updated when program progress.
**main.py:** The main file fore running FastAPI. All setup are stored here and endpoints belongs to this file.