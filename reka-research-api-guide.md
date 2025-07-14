# Reka Research API Usage Guide

## Overview

Reka Research is an agentic AI that answers complex questions by browsing private documents and the public web. The API is OpenAI-compatible and provides structured outputs with inline citations from reputable sources.

## Getting Started

### 1. Authentication

1. Create a free account on the [Reka Platform](https://platform.reka.ai)
2. Obtain your API key from your account dashboard
3. Keep your API key secure - never expose it in client-side code or share it publicly

### 2. Installation

Install the required package:

```bash
pip install openai  # Use OpenAI SDK for compatibility
```

## Basic Usage

### Using OpenAI SDK (Recommended)

```python
from openai import OpenAI

# Initialize client with Reka API
client = OpenAI(
    base_url="https://api.reka.ai/v1",
    api_key="your-api-key-here"
)

# Make a research query
completion = client.chat.completions.create(
    model="reka-flash-research",
    messages=[{
        "role": "user", 
        "content": "Who won the UEFA Nations League 2025?"
    }]
)

print(completion.choices[0].message.content)
```

### Using Reka Python Package

```python
import reka

# Set API key
reka.API_KEY = "your-api-key-here"
# Or use environment variable: export REKA_API_KEY="your-api-key"

# Simple query
response = reka.chat("What is the capital of the UK?")
print(response)
```

## API Features

### Available Models

- **reka-flash-research**: Primary research model for complex queries

### Key Capabilities

- **Web Research**: Browses the public web for up-to-date information
- **Document Analysis**: Can work with private documents and knowledge bases
- **Structured Output**: Supports JSON mode for structured responses
- **Inline Citations**: All answers include citations with exact source references
- **Multimodal Support**: Handles text, images, video, and audio inputs

### Advanced Features

- **Custom Knowledge Integration**: Built-in retrieval feature for injecting custom knowledge
- **Domain Restrictions**: Ability to limit web searches or restrict domains
- **Conversation History**: Support for multi-turn conversations
- **Customizable Execution**: Control over search parameters and output format

## API Endpoints

### Chat Completions

- **Endpoint**: `POST /v1/chat/completions`
- **Base URL**: `https://api.reka.ai/v1`
- **Compatible with**: OpenAI Chat Completions API format

### Models

- **Endpoint**: `GET /v1/models`
- **Purpose**: List available models

## Pricing

- **Cost**: $25 USD per 1,000 queries
- **Free Credits**: $20 USD included with each new account
- **Billing**: Based on number of queries, not tokens or steps

## Best Practices

1. **Security**: Always use environment variables for API keys
2. **Integration**: Use the OpenAI SDK for seamless integration with existing workflows
3. **Error Handling**: Implement proper error handling for API calls
4. **Rate Limiting**: Be mindful of query limits and costs

## Example Use Cases

- Research complex topics with current information
- Analyze documents with web context
- Generate structured reports with citations
- Answer questions requiring multi-step reasoning
- Fact-checking with source verification

## Support

- **Documentation**: [docs.reka.ai](https://docs.reka.ai)
- **Discord Community**: Real-time chat and support
- **Status Page**: [status.reka.ai](https://status.reka.ai)

## Environment Setup

```bash
# Set environment variable
export REKA_API_KEY="your-api-key-here"

# Or create a .env file
echo "REKA_API_KEY=your-api-key-here" > .env
```

## Error Handling Example

```python
from openai import OpenAI
import os

client = OpenAI(
    base_url="https://api.reka.ai/v1",
    api_key=os.getenv("REKA_API_KEY")
)

try:
    completion = client.chat.completions.create(
        model="reka-flash-research",
        messages=[{
            "role": "user",
            "content": "Your research query here"
        }]
    )
    print(completion.choices[0].message.content)
    
except Exception as e:
    print(f"Error: {e}")
```

## Notes

- The API is optimized for research queries that require web browsing and source verification
- All responses include inline citations for fact verification
- The service is designed for complex, multi-step research tasks
- Compatible with existing OpenAI-based applications with minimal changes