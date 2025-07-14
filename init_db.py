#!/usr/bin/env python3
"""
Database initialization script for Reka Research Web App
Run this script to initialize the database with required tables
"""

import os
import sys
from database import ResearchDatabase

def main():
    print("Initializing Reka Research Database...")
    
    # Check if database already exists
    db_path = "research.db"
    if os.path.exists(db_path):
        response = input(f"Database '{db_path}' already exists. Recreate? (y/N): ")
        if response.lower() == 'y':
            os.remove(db_path)
            print("[OK] Existing database removed")
        else:
            print("[INFO] Using existing database")
    
    try:
        # Initialize database
        db = ResearchDatabase(db_path)
        print("[OK] Database initialized successfully!")
        
        # Show database info
        stats = db.get_database_stats()
        print(f"\nDatabase Statistics:")
        print(f"   - Total queries: {stats.get('total_queries', 0)}")
        print(f"   - Total sessions: {stats.get('total_sessions', 0)}")
        print(f"   - Database file: {os.path.abspath(db_path)}")
        
        # Test database functionality
        print("\nTesting database functionality...")
        
        # Create test session
        test_session = "test_session_001"
        if db.create_session(test_session):
            print("[OK] Session creation: OK")
        else:
            print("[ERROR] Session creation: FAILED")
            return False
        
        # Save test research
        if db.save_research(
            session_id=test_session,
            query="Test query: What is the capital of France?",
            response="The capital of France is Paris.",
            model="reka-flash-research",
            tokens_used=25,
            response_time=1.2
        ):
            print("[OK] Research saving: OK")
        else:
            print("[ERROR] Research saving: FAILED")
            return False
        
        # Retrieve test data
        history = db.get_session_history(test_session)
        if history and len(history) > 0:
            print("[OK] Data retrieval: OK")
        else:
            print("[ERROR] Data retrieval: FAILED")
            return False
        
        print("\n[SUCCESS] Database initialization completed successfully!")
        print("Ready to use with the Reka Research Web App")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Database initialization failed: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)