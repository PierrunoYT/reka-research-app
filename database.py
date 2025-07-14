import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional
import os

class ResearchDatabase:
    def __init__(self, db_path: str = "research.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize the database with required tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create research_sessions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS research_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create research_queries table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS research_queries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                query TEXT NOT NULL,
                response TEXT NOT NULL,
                model TEXT DEFAULT 'reka-flash-research',
                tokens_used INTEGER DEFAULT 0,
                response_time REAL DEFAULT 0.0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES research_sessions (session_id)
            )
        ''')
        
        # Create indexes for better performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_session_id ON research_queries(session_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_created_at ON research_queries(created_at)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_query_text ON research_queries(query)')
        
        conn.commit()
        conn.close()
    
    def create_session(self, session_id: str) -> bool:
        """Create a new research session"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR IGNORE INTO research_sessions (session_id)
                VALUES (?)
            ''', (session_id,))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error creating session: {e}")
            return False
    
    def save_research(self, session_id: str, query: str, response: str, 
                     model: str = 'reka-flash-research', tokens_used: int = 0, 
                     response_time: float = 0.0) -> bool:
        """Save a research query and response to the database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Ensure session exists
            self.create_session(session_id)
            
            # Insert research query
            cursor.execute('''
                INSERT INTO research_queries 
                (session_id, query, response, model, tokens_used, response_time)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (session_id, query, response, model, tokens_used, response_time))
            
            # Update session timestamp
            cursor.execute('''
                UPDATE research_sessions 
                SET updated_at = CURRENT_TIMESTAMP 
                WHERE session_id = ?
            ''', (session_id,))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error saving research: {e}")
            return False
    
    def get_session_history(self, session_id: str) -> List[Dict]:
        """Get all research queries for a specific session"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, query, response, model, tokens_used, response_time, created_at
                FROM research_queries
                WHERE session_id = ?
                ORDER BY created_at ASC
            ''', (session_id,))
            
            rows = cursor.fetchall()
            conn.close()
            
            return [
                {
                    'id': row[0],
                    'query': row[1],
                    'response': row[2],
                    'model': row[3],
                    'tokens_used': row[4],
                    'response_time': row[5],
                    'created_at': row[6]
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting session history: {e}")
            return []
    
    def get_all_sessions(self) -> List[Dict]:
        """Get all research sessions with summary info"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT 
                    s.session_id,
                    s.created_at,
                    s.updated_at,
                    COUNT(q.id) as query_count,
                    q.query as last_query
                FROM research_sessions s
                LEFT JOIN research_queries q ON s.session_id = q.session_id
                LEFT JOIN (
                    SELECT session_id, MAX(created_at) as max_created
                    FROM research_queries
                    GROUP BY session_id
                ) latest ON s.session_id = latest.session_id AND q.created_at = latest.max_created
                GROUP BY s.session_id
                ORDER BY s.updated_at DESC
            ''')
            
            rows = cursor.fetchall()
            conn.close()
            
            return [
                {
                    'session_id': row[0],
                    'created_at': row[1],
                    'updated_at': row[2],
                    'query_count': row[3],
                    'last_query': row[4]
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error getting all sessions: {e}")
            return []
    
    def search_queries(self, search_term: str, limit: int = 50) -> List[Dict]:
        """Search for queries containing specific terms"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT id, session_id, query, response, created_at
                FROM research_queries
                WHERE query LIKE ? OR response LIKE ?
                ORDER BY created_at DESC
                LIMIT ?
            ''', (f'%{search_term}%', f'%{search_term}%', limit))
            
            rows = cursor.fetchall()
            conn.close()
            
            return [
                {
                    'id': row[0],
                    'session_id': row[1],
                    'query': row[2],
                    'response': row[3],
                    'created_at': row[4]
                }
                for row in rows
            ]
        except Exception as e:
            print(f"Error searching queries: {e}")
            return []
    
    def get_database_stats(self) -> Dict:
        """Get database statistics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get total queries
            cursor.execute('SELECT COUNT(*) FROM research_queries')
            total_queries = cursor.fetchone()[0]
            
            # Get total sessions
            cursor.execute('SELECT COUNT(*) FROM research_sessions')
            total_sessions = cursor.fetchone()[0]
            
            # Get total tokens used
            cursor.execute('SELECT SUM(tokens_used) FROM research_queries')
            total_tokens = cursor.fetchone()[0] or 0
            
            # Get average response time
            cursor.execute('SELECT AVG(response_time) FROM research_queries WHERE response_time > 0')
            avg_response_time = cursor.fetchone()[0] or 0.0
            
            conn.close()
            
            return {
                'total_queries': total_queries,
                'total_sessions': total_sessions,
                'total_tokens': total_tokens,
                'avg_response_time': round(avg_response_time, 2)
            }
        except Exception as e:
            print(f"Error getting database stats: {e}")
            return {}
    
    def clear_all_data(self) -> bool:
        """Clear all research data from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Delete all queries first (due to foreign key constraint)
            cursor.execute('DELETE FROM research_queries')
            
            # Delete all sessions
            cursor.execute('DELETE FROM research_sessions')
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Error clearing all data: {e}")
            return False
    
    def close(self):
        """Close database connection (if needed for cleanup)"""
        pass