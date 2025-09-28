import { WebContainer } from '@webcontainer/api';
import React, { useEffect, useState } from 'react';

interface PreviewFrameProps {
  files: any[];
  webContainer: WebContainer | undefined;
}

export function PreviewFrame({ files, webContainer }: PreviewFrameProps) {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Convert your files array to WebContainer file structure
  const convertFilesToWebContainerFormat = (files: any[]) => {
    const fileSystem: any = {};
    
    files.forEach(file => {
      if (file.type === 'file' && file.path && file.content) {
        // Remove leading slash if present
        const cleanPath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        const pathParts = cleanPath.split('/');
        
        // Create nested structure
        let current = fileSystem;
        for (let i = 0; i < pathParts.length - 1; i++) {
          if (!current[pathParts[i]]) {
            current[pathParts[i]] = {
              directory: {}
            };
          }
          current = current[pathParts[i]].directory;
        }
        
        // Add the file
        const fileName = pathParts[pathParts.length - 1];
        current[fileName] = {
          file: {
            contents: file.content
          }
        };
      }
    });
    
    return fileSystem;
  };

  async function setupAndRun() {
    if (!webContainer || files.length === 0) {
      console.log('WebContainer or files not available:', { webContainer: !!webContainer, filesCount: files.length });
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setUrl("");

      // Convert and mount files to WebContainer
      const fileSystem = convertFilesToWebContainerFormat(files);
      console.log('Setting up files:', fileSystem);
      console.log('Files array:', files);
      
      await webContainer.mount(fileSystem);

      // Fix vite.config.ts if it has syntax errors
      const viteConfigFile = files.find(file => file.path?.endsWith('vite.config.ts') && file.type === 'file');
      if (viteConfigFile && viteConfigFile.content) {
        // Check if the config has the malformed syntax
        if (viteConfigFile.content.includes('exclude:') && !viteConfigFile.content.includes('optimizeDeps: {')) {
          console.log('Fixing malformed vite.config.ts...');
          const fixedConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});`;
          
          // Update the file with fixed config
          await webContainer.mount({
            'vite.config.ts': {
              file: {
                contents: fixedConfig
              }
            }
          });
          console.log('Fixed vite.config.ts');
        }
      }

      // Check if package.json exists
      const packageJsonFile = files.find(file => 
        file.path?.endsWith('package.json') && file.type === 'file'
      );

      if (!packageJsonFile) {
        // Try to create a basic package.json for static files
        console.log('No package.json found, checking for HTML files...');
        const hasHtmlFile = files.some(file => file.path?.endsWith('.html'));
        
        if (hasHtmlFile) {
          console.log('HTML files found, creating basic static server setup...');
          
          // Create a simple static server
          const basicPackageJson = {
            file: {
              contents: JSON.stringify({
                "name": "static-preview",
                "version": "1.0.0",
                "scripts": {
                   "dev": "npx vite --port 4173 --host", // Different port with host
                    "start": "npx http-server . -p 4173 -c-1"
                }
              }, null, 2)
            }
          };
          
          await webContainer.mount({
            'package.json': basicPackageJson
          });
        } else {
          setError("No package.json or HTML files found");
          setIsLoading(false);
          return;
        }
      }

      // Install dependencies (skip if it's just static files)
      const needsInstall = packageJsonFile?.content?.includes('"dependencies"') || 
                           packageJsonFile?.content?.includes('"devDependencies"');
      
      if (needsInstall) {
        console.log('Installing dependencies...');
        const installProcess = await webContainer.spawn('npm', ['install']);

        let installOutput = '';
        installProcess.output.pipeTo(new WritableStream({
          write(data) {
            installOutput += data;
            console.log('Install:', data);
          }
        }));

        const installExitCode = await installProcess.exit;
        
        if (installExitCode !== 0) {
          console.error('Install failed with exit code:', installExitCode);
          console.error('Install output:', installOutput);
          setError(`Failed to install dependencies (exit code: ${installExitCode})`);
          setIsLoading(false);
          return;
        }
      } else {
        console.log('Skipping npm install - no dependencies found');
      }

      // Find available dev script
      let packageJson: any = {};
      if (packageJsonFile?.content) {
        try {
          packageJson = JSON.parse(packageJsonFile.content);
        } catch (err) {
          console.error('Error parsing package.json:', err);
        }
      }
      
      const scripts = packageJson.scripts || {};
      let devScript = 'dev';
      
      // Check for common dev script names
      if (scripts.dev) {
        devScript = 'dev';
      } else if (scripts.start) {
        devScript = 'start';
      } else if (scripts.serve) {
        devScript = 'serve';
      } else if (scripts.preview) {
        devScript = 'preview';
      } else {
        // For static files, try to serve directly
        const hasHtmlFile = files.some(file => file.path?.endsWith('.html'));
        if (hasHtmlFile) {
          console.log('No npm scripts found, trying to serve static files...');
          devScript = 'dev'; // We created this script above
        } else {
          const availableScripts = Object.keys(scripts);
          setError(`No dev script found. Available scripts: ${availableScripts.join(', ') || 'none'}`);
          setIsLoading(false);
          return;
        }
      }

      // Start dev server
      console.log(`Starting dev server with: npm run ${devScript}`);
      const devProcess = await webContainer.spawn('npm', ['run', devScript]);

      let serverOutput = '';
      devProcess.output.pipeTo(new WritableStream({
        write(data) {
          serverOutput += data;
          console.log('Server:', data);
        }
      }));

      // Listen for server-ready event
      const serverReadyPromise = new Promise<{url: string; port?: number} | null>((resolve) => {
        webContainer.on('server-ready', (port, url) => {
          console.log('Server ready event:', { url, port });
          resolve({ url, port });
        });
      });

      // Also check for manual URL detection in output
      const outputUrlPromise = new Promise<{url: string} | null>((resolve) => {
        setTimeout(() => {
          // Look for common server URL patterns in output
          const patterns = [
            /Local:\s*(https?:\/\/[^\s\]]+)/i,
            /Network:\s*(https?:\/\/[^\s\]]+)/i,
            /Server running at\s*(https?:\/\/[^\s\]]+)/i,
            /https?:\/\/localhost:\d+/g,
            /localhost:(\d+)/i,
            /127\.0\.0\.1:(\d+)/i
          ];
          
          for (const pattern of patterns) {
            const match = serverOutput.match(pattern);
            if (match) {
              let url = match[1] || match[0];
              // If we only got a port, construct full URL
              if (!url.startsWith('http')) {
                const portMatch = url.match(/(\d+)/);
                if (portMatch) {
                  url = `http://localhost:${portMatch[1]}`;
                }
              }
              console.log('Found URL pattern:', pattern.toString(), 'URL:', url);
              resolve({ url });
              return;
            }
          }
          
          resolve(null);
        }, 8000); // Wait 8 seconds for server to fully start
      });

      // Race between server-ready event and manual detection
      const result = await Promise.race([
        serverReadyPromise,
        outputUrlPromise,
        new Promise<null>(resolve => setTimeout(() => resolve(null), 20000)) // 20 second timeout
      ]);

      if (result?.url) {
        console.log('Preview URL ready:', result.url);
        setUrl(result.url);
        setIsLoading(false);
      } else {
        console.log('Server output so far:', serverOutput);
        
        // Last resort: try to extract any port number and construct URL
        const portMatches = serverOutput.match(/(\d{4,5})/g);
        if (portMatches) {
          // Use the last port found (usually the server port)
          const port = portMatches[portMatches.length - 1];
          const constructedUrl = `http://localhost:${port}`;
          console.log('Constructed URL from port:', constructedUrl);
          setUrl(constructedUrl);
          setIsLoading(false);
        } else {
          setError('Server started but no accessible URL found. Check console output.');
          setIsLoading(false);
        }
      }

    } catch (err: unknown) {
      console.error('Error setting up WebContainer:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Setup error: ${errorMessage}`);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (webContainer && files.length > 0) {
      setupAndRun();
    }
  }, [webContainer, files]);

  // Show loading state when webContainer is undefined
  if (!webContainer) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#9ca3af'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '2rem',
            height: '2rem',
            border: '2px solid #374151',
            borderTop: '2px solid #9ca3af',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 0.5rem auto'
          }}></div>
          <p style={{ margin: '0' }}>Initializing WebContainer...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ef4444'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '24rem' }}>
          <p style={{ margin: '0 0 1rem 0', fontWeight: '600' }}>Preview Error</p>
          <p style={{ margin: '0', fontSize: '0.875rem' }}>{error}</p>
          <button
            onClick={setupAndRun}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {(isLoading || !url) && (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '2rem',
              height: '2rem',
              border: '2px solid #374151',
              borderTop: '2px solid #9ca3af',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 0.5rem auto'
            }}></div>
            <p style={{ margin: '0' }}>Setting up development server...</p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem' }}>
              Installing dependencies and starting preview...
            </p>
          </div>
        </div>
      )}
      {url && <iframe width="100%" height="100%" src={url} style={{ border: 'none' }} />}
    </div>
  );
}