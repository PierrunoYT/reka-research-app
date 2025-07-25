from flask import Flask, request, jsonify, render_template, session, Response
from openai import OpenAI
import os
from dotenv import load_dotenv
import logging
import time
import uuid
import json
from database import ResearchDatabase

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Reka client
client = OpenAI(
    base_url="https://api.reka.ai/v1",
    api_key=os.getenv("REKA_API_KEY")
)

# Initialize database
db = ResearchDatabase()

def handle_streaming_response(messages, session_id, user_message, start_time):
    """Handle streaming response from Reka Research API"""
    def generate():
        try:
            response_content = ""
            
            # Make streaming API call to Reka Research
            completion = client.chat.completions.create(
                model="reka-flash-research",
                messages=messages,
                stream=True
            )
            
            # Send initial metadata
            yield f"data: {json.dumps({'type': 'start', 'session_id': session_id})}\n\n"
            
            # Process streaming chunks
            for chunk in completion:
                if chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    response_content += content
                    
                    # Send content chunk
                    yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
            
            # Calculate response time
            response_time = time.time() - start_time
            
            # Save complete response to database
            tokens_used = 0  # Note: streaming may not provide token count
            if session_id:
                db.save_research(
                    session_id=session_id,
                    query=user_message,
                    response=response_content,
                    model="reka-flash-research",
                    tokens_used=tokens_used,
                    response_time=response_time
                )
            
            # Add to messages
            messages.append({
                "role": "assistant",
                "content": response_content
            })
            
            # Send completion data
            yield f"data: {json.dumps({'type': 'complete', 'session_id': session_id, 'messages': messages, 'response_time': response_time})}\n\n"
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            logger.error(f"Error in streaming response: {str(e)}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
    
    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        }
    )

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        
        if not user_message:
            return jsonify({'error': 'Message is required'}), 400
        
        # Get or create session ID
        session_id = data.get('session_id')
        if not session_id:
            session_id = str(uuid.uuid4())
            db.create_session(session_id)
        
        # Get conversation history if provided
        messages = data.get('messages', [])
        messages.append({
            "role": "user",
            "content": user_message
        })
        
        # Record start time for response time measurement
        start_time = time.time()
        
        # Check if streaming is requested
        stream_request = data.get('stream', False)
        
        if stream_request:
            # Handle streaming response
            return handle_streaming_response(messages, session_id, user_message, start_time)
        
        # Make API call to Reka Research (non-streaming)
        try:
            completion = client.chat.completions.create(
                model="reka-flash-research",
                messages=messages,
                stream=False
            )
        except Exception as api_error:
            logger.error(f"Reka API error: {str(api_error)}")
            return jsonify({
                'error': f'Reka API error: {str(api_error)}',
                'success': False
            }), 500
        
        # Calculate response time
        response_time = time.time() - start_time
        
        response_content = completion.choices[0].message.content
        
        # Add assistant response to messages
        messages.append({
            "role": "assistant",
            "content": response_content
        })
        
        # Save research to database
        tokens_used = completion.usage.total_tokens if hasattr(completion, 'usage') and completion.usage else 0
        db.save_research(
            session_id=session_id,
            query=user_message,
            response=response_content,
            model="reka-flash-research",
            tokens_used=tokens_used,
            response_time=response_time
        )
        
        return jsonify({
            'response': response_content,
            'messages': messages,
            'session_id': session_id,
            'success': True
        })
        
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        return jsonify({
            'error': 'An error occurred while processing your request',
            'details': str(e),
            'success': False
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'Reka Research Web App'})

@app.route('/api/models', methods=['GET'])
def get_models():
    try:
        models = client.models.list()
        return jsonify({
            'models': [model.id for model in models.data],
            'success': True
        })
    except Exception as e:
        logger.error(f"Error fetching models: {str(e)}")
        return jsonify({
            'error': 'Failed to fetch models',
            'details': str(e),
            'success': False
        }), 500

@app.route('/api/history', methods=['GET'])
def get_research_history():
    try:
        sessions = db.get_all_sessions()
        return jsonify({
            'sessions': sessions,
            'success': True
        })
    except Exception as e:
        logger.error(f"Error fetching research history: {str(e)}")
        return jsonify({
            'error': 'Failed to fetch research history',
            'details': str(e),
            'success': False
        }), 500

@app.route('/api/history/<session_id>', methods=['GET'])
def get_session_history(session_id):
    try:
        history = db.get_session_history(session_id)
        return jsonify({
            'session_id': session_id,
            'history': history,
            'success': True
        })
    except Exception as e:
        logger.error(f"Error fetching session history: {str(e)}")
        return jsonify({
            'error': 'Failed to fetch session history',
            'details': str(e),
            'success': False
        }), 500

@app.route('/api/search', methods=['GET'])
def search_research():
    try:
        search_term = request.args.get('q', '')
        limit = int(request.args.get('limit', 50))
        
        if not search_term:
            return jsonify({'error': 'Search term is required'}), 400
        
        results = db.search_queries(search_term, limit)
        return jsonify({
            'search_term': search_term,
            'results': results,
            'success': True
        })
    except Exception as e:
        logger.error(f"Error searching research: {str(e)}")
        return jsonify({
            'error': 'Failed to search research',
            'details': str(e),
            'success': False
        }), 500

@app.route('/api/stats', methods=['GET'])
def get_database_stats():
    try:
        stats = db.get_database_stats()
        return jsonify({
            'stats': stats,
            'success': True
        })
    except Exception as e:
        logger.error(f"Error fetching database stats: {str(e)}")
        return jsonify({
            'error': 'Failed to fetch database stats',
            'details': str(e),
            'success': False
        }), 500

@app.route('/api/reset', methods=['POST'])
def reset_database():
    try:
        # Get confirmation from request
        data = request.get_json()
        if not data or not data.get('confirm'):
            return jsonify({
                'error': 'Confirmation required',
                'success': False
            }), 400
        
        # Reset database by reinitializing
        global db
        import os
        db_path = "research.db"
        
        # Close existing connection if any
        db.close()
        
        # Remove existing database file
        if os.path.exists(db_path):
            os.remove(db_path)
            logger.info("Database file removed")
        
        # Reinitialize database
        db = ResearchDatabase(db_path)
        logger.info("Database reset successfully")
        
        return jsonify({
            'message': 'Database reset successfully',
            'success': True
        })
        
    except Exception as e:
        logger.error(f"Error resetting database: {str(e)}")
        return jsonify({
            'error': 'Failed to reset database',
            'details': str(e),
            'success': False
        }), 500

@app.route('/api/clear', methods=['POST'])
def clear_database():
    try:
        # Get confirmation from request
        data = request.get_json()
        if not data or not data.get('confirm'):
            return jsonify({
                'error': 'Confirmation required',
                'success': False
            }), 400
        
        # Clear all data from database
        if db.clear_all_data():
            logger.info("Database cleared successfully")
            return jsonify({
                'message': 'Database cleared successfully',
                'success': True
            })
        else:
            return jsonify({
                'error': 'Failed to clear database',
                'success': False
            }), 500
        
    except Exception as e:
        logger.error(f"Error clearing database: {str(e)}")
        return jsonify({
            'error': 'Failed to clear database',
            'details': str(e),
            'success': False
        }), 500

if __name__ == '__main__':
    if not os.getenv('REKA_API_KEY'):
        logger.warning("REKA_API_KEY not found in environment variables")
        print("Please set your REKA_API_KEY in the .env file")
    
    app.run(debug=True, host='0.0.0.0', port=5000)