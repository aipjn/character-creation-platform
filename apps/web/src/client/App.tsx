import React, { useState } from 'react';
import { EnhancedCharacterWizard } from '../components/CharacterInput/EnhancedCharacterWizard';
import { CharacterLibrary } from '../components/Library/CharacterLibrary';
import { SceneBuilder } from '../components/Scenes/SceneBuilder';
import { CharacterWorkflowPanel } from '../components/Workflow/CharacterWorkflowPanel';
import { Character } from '../types/character';

type ViewMode = 'create' | 'library' | 'scenes' | 'workflow';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewMode>('create');
  const [selectedCharacters, setSelectedCharacters] = useState<Character[]>([]);

  const handleCharacterCreated = (character: Character) => {
    // Add character to selected characters for workflow
    setSelectedCharacters(prev => [...prev, character]);
  };

  const handleViewChange = (view: ViewMode) => {
    setCurrentView(view);
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'create':
        return <EnhancedCharacterWizard onCharacterCreated={handleCharacterCreated} />;
      case 'library':
        return <CharacterLibrary />;
      case 'scenes':
        return <SceneBuilder />;
      case 'workflow':
        return <CharacterWorkflowPanel selectedCharacters={selectedCharacters} />;
      default:
        return <EnhancedCharacterWizard onCharacterCreated={handleCharacterCreated} />;
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <h1>角色创作平台</h1>
            <span className="subtitle">Character Creation Platform</span>
          </div>
          <div className="user-info">
            <span>欢迎回来 Welcome back</span>
            <div className="credits">3 credits</div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="main-nav">
        <div className="nav-content">
          <button 
            className={`nav-item ${currentView === 'create' ? 'active' : ''}`}
            onClick={() => handleViewChange('create')}
          >
            🎨 角色创造 Create Character
          </button>
          <button 
            className={`nav-item ${currentView === 'library' ? 'active' : ''}`}
            onClick={() => handleViewChange('library')}
          >
            📚 角色库 Character Library  
          </button>
          <button 
            className={`nav-item ${currentView === 'scenes' ? 'active' : ''}`}
            onClick={() => handleViewChange('scenes')}
          >
            🎬 场景建造 Scene Builder
          </button>
          <button 
            className={`nav-item ${currentView === 'workflow' ? 'active' : ''}`}
            onClick={() => handleViewChange('workflow')}
          >
            ⚡ 工作流程 Workflow
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-container">
          {renderCurrentView()}
        </div>
      </main>

      {/* Global Styles */}
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :root {
          --primary: #2563EB;
          --primary-gradient: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%);
          --success: #10B981;
          --warning: #F59E0B;
          --error: #EF4444;
          --background: #FFFFFF;
          --gray-light: #F8FAFC;
          --gray-border: #E1E5E9;
          --text-primary: #1F2937;
          --text-secondary: #6B7280;
          --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }

        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          background: var(--gray-light);
          color: var(--text-primary);
          line-height: 1.6;
          min-height: 100vh;
        }

        .app {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* Header Styles */
        .app-header {
          background: var(--background);
          border-bottom: 1px solid var(--gray-border);
          padding: 1rem 0;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: var(--shadow);
        }

        .header-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo h1 {
          font-size: 1.75rem;
          font-weight: 700;
          background: var(--primary-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 0.25rem;
        }

        .logo .subtitle {
          font-size: 0.875rem;
          color: var(--text-secondary);
          font-weight: 400;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .credits {
          background: var(--primary);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.75rem;
          font-weight: 500;
        }

        /* Navigation Styles */
        .main-nav {
          background: var(--background);
          border-bottom: 1px solid var(--gray-border);
          padding: 0.5rem 0;
        }

        .nav-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          gap: 0.5rem;
        }

        .nav-item {
          padding: 0.75rem 1.5rem;
          background: none;
          border: none;
          border-radius: 0.5rem;
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--text-secondary);
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .nav-item:hover {
          background: var(--gray-light);
          color: var(--text-primary);
        }

        .nav-item.active {
          background: var(--primary);
          color: white;
        }

        /* Main Content Styles */
        .main-content {
          flex: 1;
          padding: 2rem 0;
        }

        .content-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .header-content,
          .nav-content,
          .content-container {
            padding: 0 1rem;
          }

          .logo h1 {
            font-size: 1.5rem;
          }

          .nav-content {
            flex-wrap: wrap;
          }

          .nav-item {
            font-size: 0.8rem;
            padding: 0.5rem 1rem;
          }

          .main-content {
            padding: 1rem 0;
          }
        }

        @media (max-width: 480px) {
          .user-info {
            flex-direction: column;
            align-items: flex-end;
            gap: 0.5rem;
          }

          .nav-content {
            justify-content: center;
          }

          .nav-item {
            flex: 1;
            min-width: 0;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};

export default App;