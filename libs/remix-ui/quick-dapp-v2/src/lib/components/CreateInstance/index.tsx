import React, { useContext } from 'react';
import { Card } from 'react-bootstrap';
import { AppContext } from '../../contexts';
import { FrontendMode, GenerationProgress } from '../../types';

interface CreateInstanceProps {
  isAiLoading: boolean;
}

const statusMessages: Record<string, string> = {
  preparing: 'Preparing generation...',
  calling_llm: 'Calling AI model...',
  generating_file: 'Generating files...',
  parsing: 'Parsing generated files...',
  validating: 'Validating file structure...',
  complete: 'Generation complete!',
};

const FrontendModeSelector: React.FC = () => {
  const { appState, dispatch } = useContext(AppContext);
  const mode: FrontendMode = appState.frontendMode || 'workspace';

  return (
    <div className="mb-4" data-id="quickdapp-frontend-mode-selector">
      <h5 className="mb-2">Where should the frontend be created?</h5>
      <div className="d-flex gap-3">
        <div
          className={`border rounded p-3 flex-grow-1 cursor-pointer ${
            mode === 'workspace' ? 'border-primary bg-primary bg-opacity-10' : ''
          }`}
          style={{ cursor: 'pointer' }}
          onClick={() => dispatch({ type: 'SET_FRONTEND_MODE', payload: 'workspace' })}
          data-id="quickdapp-mode-workspace"
        >
          <div className="d-flex align-items-center mb-1">
            <input
              type="radio"
              readOnly
              checked={mode === 'workspace'}
              className="me-2"
              style={{ pointerEvents: 'none' }}
            />
            <strong>New Workspace</strong>
          </div>
          <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>
            Creates a dedicated workspace (e.g. <code>dapp-mycontract-abc123</code>) for the frontend. Switch between
            workspaces to interact with the contract and the DApp separately.
          </p>
        </div>

        <div
          className={`border rounded p-3 flex-grow-1 cursor-pointer ${
            mode === 'inline' ? 'border-primary bg-primary bg-opacity-10' : ''
          }`}
          style={{ cursor: 'pointer' }}
          onClick={() => dispatch({ type: 'SET_FRONTEND_MODE', payload: 'inline' })}
          data-id="quickdapp-mode-inline"
        >
          <div className="d-flex align-items-center mb-1">
            <input
              type="radio"
              readOnly
              checked={mode === 'inline'}
              className="me-2"
              style={{ pointerEvents: 'none' }}
            />
            <strong><code>/frontend</code> folder <span className="badge bg-success ms-1" style={{ fontSize: '0.7rem' }}>New</span></strong>
          </div>
          <p className="text-muted mb-0" style={{ fontSize: '0.85rem' }}>
            Adds a <code>/frontend</code> directory directly in your current workspace — no workspace switching needed.
            Ideal when you want the contract and its UI side by side in the file explorer.
          </p>
        </div>
      </div>
    </div>
  );
};

const CreateInstance: React.FC<CreateInstanceProps> = ({ isAiLoading }) => {
  const { appState } = useContext(AppContext);
  const progress: GenerationProgress | null = appState.generationProgress;

  if (isAiLoading) {
    const currentFile = progress?.filename;
    const generatedFiles = progress?.generatedFiles || [];
    const statusText = progress?.status
      ? (progress.status === 'generating_file' && currentFile
        ? `Writing ${currentFile}`
        : statusMessages[progress.status] || 'Creating DApp')
      : 'Creating DApp';

    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5" data-id="ai-loading-spinner">
        <div className="spinner-border qd-progress-spinner qd-progress-spinner--lg mb-3" role="status"></div>
        <h5 className="text-body fw-bold">{statusText}</h5>
        <p className="text-muted">RemixAI is generating your DApp.</p>

        {generatedFiles.length > 0 && (
          <div className="mt-2 qd-progress-log qd-progress-log--lg" style={{ maxWidth: 400, width: '100%' }}>
            {generatedFiles.map((f) => (
              <div key={f} className="qd-progress-log__done">{f}</div>
            ))}
            {progress?.status === 'generating_file' && currentFile && !generatedFiles.includes(currentFile) && (
              <div className="qd-progress-log__write">{currentFile}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="text-center mb-4">
        <h2 className="mb-2">Welcome to QuickDapp</h2>
        <p className="text-muted mb-0 fs-5">
          Transform your smart contracts into interactive DApps with AI.
        </p>
      </div>

      <FrontendModeSelector />

      <Card className="border-info" data-id="quickdapp-getting-started">
        <Card.Header className="bg-info bg-opacity-10 border-info">
          <h4 className="mb-0 text-info">
            <i className="fas fa-rocket me-2"></i>
            Getting Started
          </h4>
        </Card.Header>
        <Card.Body>
          <p className="mb-4 fs-5">After deploying your contract, create a DApp using one of these options:</p>

          <div className="row g-4">
            <div className="col-12 col-md-6 qd-grid-col">
              <div className="border rounded p-3 h-100">
                <h5 className="text-primary mb-3">
                  <i className="fas fa-flag me-2"></i>
                  Option 1: Start Now Banner
                </h5>
                <p className="text-muted mb-3">
                  Click the <span className="badge bg-primary">Start now</span> button in the banner above the editor.
                </p>
                <img
                  src='assets/img/start-now-guide.png'
                  alt="Start now guide"
                  className="img-fluid rounded shadow-sm w-80"
                  style={{
                    border: '1px solid var(--secondary)',
                    objectFit: 'contain',
                    maxHeight: '300px',
                    display: 'block',
                    margin: '0 auto'
                  }}
                />
              </div>
            </div>

            <div className="col-12 col-md-6 qd-grid-col">
              <div className="border rounded p-3 h-100">
                <h5 className="text-primary mb-3">
                  <i className="fas fa-magic me-2"></i>
                  Option 2: Create a DApp
                </h5>
                <p className="text-muted mb-3">
                  Click the "Create a DApp" on your deployed contract instance.
                </p>
                <img
                  src='assets/img/create-a-dapp.png'
                  alt="Create a dapp guide"
                  className="img-fluid rounded shadow-sm w-80"
                  style={{
                    border: '1px solid var(--secondary)',
                    objectFit: 'contain',
                    maxHeight: '300px',
                    display: 'block',
                    margin: '0 auto'
                  }}
                />
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default CreateInstance;