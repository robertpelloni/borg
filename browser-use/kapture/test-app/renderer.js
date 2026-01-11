// Renderer process for Kapture MCP Test Client
let connected = false;
let currentTools = [];
let currentResources = [];
let currentTabs = [];
let selectedTabId = null;

// DOM elements
const statusEl = document.getElementById('status');
const statusTextEl = document.getElementById('status-text');
const refreshTabsBtn = document.getElementById('refresh-tabs');
const tabListEl = document.getElementById('tab-list');
const toolsListEl = document.getElementById('tools-list');
const resourcesListEl = document.getElementById('resources-list');
const contentContainerEl = document.getElementById('content-container');
const consoleEl = document.getElementById('console-output');
const tabInfoEl = document.getElementById('tab-info-content');
const consoleDividerEl = document.getElementById('console-divider');
const consoleContainerEl = document.getElementById('console');

// Tool forms state - store form data per tab
const tabFormData = {};

// Selected item state
let selectedItem = null; // { type: 'tool'|'resource', name: string }

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Logging
function log(message, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `console-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  consoleEl.appendChild(entry);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Server management
async function connectToServer() {
  try {
    log('Connecting to MCP server...');
    statusTextEl.textContent = 'Connecting...';

    const result = await window.electronAPI.connectMCP();

    if (result.success) {
      connected = true;
      statusEl.classList.add('connected');

      // Get the port number
      const port = await window.electronAPI.getPort();
      statusTextEl.textContent = `Connected to MCP (ws://localhost:${port}/mcp)`;
      refreshTabsBtn.disabled = false;

      log(`Connected to MCP WebSocket server at ws://localhost:${port}/mcp`, 'info');
      log(`Server capabilities: ${JSON.stringify(result.capabilities)}`, 'info');

      // Auto-discover tools and resources
      await discoverTools();
      await discoverResources();

      // Don't poll - we'll get notifications when tabs connect
      log('Waiting for tab connections...', 'info');
    } else {
      throw new Error(result.error || 'Failed to connect to server');
    }
  } catch (error) {
    log(`Failed to connect to server: ${error.message}`, 'error');
    connected = false;
    statusEl.classList.remove('connected');
    statusTextEl.textContent = 'Connection Failed';
    refreshTabsBtn.disabled = true;

    // The WebSocket connection will handle reconnection automatically
  }
}

// Tool discovery
async function discoverTools() {
  try {
    log('Discovering available tools...');
    const response = await window.electronAPI.sendMCPRequest('tools/list');
    currentTools = response.tools || [];
    log(`Found ${currentTools.length} tools`);
    displayToolsList();
  } catch (error) {
    log(`Failed to discover tools: ${error.message}`, 'error');
  }
}

// Resource discovery
async function discoverResources() {
  try {
    log('Discovering available resources...');
    const response = await window.electronAPI.sendMCPRequest('resources/list');
    currentResources = response.resources || [];
    log(`Found ${currentResources.length} resources`);
    displayResourcesList();
  } catch (error) {
    log(`Failed to discover resources: ${error.message}`, 'error');
  }
}


// Tab management
refreshTabsBtn.addEventListener('click', () => refreshTabs(false));

async function refreshTabs(silent = false) {
  try {
    if (!silent) {
      log('Querying tabs resource...');
    }

    const response = await window.electronAPI.sendMCPRequest('resources/read', {
      uri: 'kapture://tabs'
    });

    // Parse the resource data
    const newTabs = response.contents && response.contents[0]
      ? JSON.parse(response.contents[0].text)
      : [];

    if (!silent) {
      log(`Found ${newTabs.length} connected tabs`);
      // Debug: Log the tab data from manual refresh
      if (newTabs.length > 0) {
        log(`Manual refresh tab data: ${JSON.stringify(newTabs)}`, 'debug');
      }
    }

    currentTabs = newTabs;
    displayTabs();

    // Auto-select first tab if none selected
    if (!selectedTabId && currentTabs.length > 0) {
      selectTab(currentTabs[0].tabId);
    } else if (selectedTabId) {
      // Update tab content if already selected
      updateTabInfo();
    }

    // If selected tab is gone, clear selection
    if (selectedTabId && !currentTabs.find(t => t.tabId === selectedTabId)) {
      selectedTabId = null;
      updateTabInfo();
    }
  } catch (error) {
    if (!silent) {
      log(`Failed to query tabs resource: ${error.message}`, 'error');
    }
  }
}

function displayTabs() {
  tabListEl.innerHTML = '';

  if (currentTabs.length === 0) {
    tabListEl.innerHTML = '<div class="empty-state" style="padding: 0.5rem;">Looking for Chrome tabs...</div>';
    return;
  }

  // Debug: Log what we're about to display
  log(`Displaying ${currentTabs.length} tabs`, 'debug');

  currentTabs.forEach(tab => {
    const tabEl = document.createElement('button');
    tabEl.className = 'tab-item';
    if (tab.tabId === selectedTabId) {
      tabEl.classList.add('active');
    }

    tabEl.innerHTML = `<span class="tab-title">${tab.title || 'Untitled'}</span>`;

    // Add tooltip with tab dimensions
    let tooltipText = `Tab ID: ${tab.tabId}\nURL: ${tab.url || 'Unknown'}`;
    if (tab.domSize) {
      tooltipText += `\nDOM Size: ${(tab.domSize / 1024).toFixed(1)} KB`;
    }
    if (tab.fullPageDimensions) {
      tooltipText += `\nPage Size: ${tab.fullPageDimensions.width}×${tab.fullPageDimensions.height}`;
    }
    if (tab.viewportDimensions) {
      tooltipText += `\nViewport: ${tab.viewportDimensions.width}×${tab.viewportDimensions.height}`;
    }
    tabEl.title = tooltipText;

    tabEl.addEventListener('click', () => selectTab(tab.tabId));
    tabListEl.appendChild(tabEl);
  });
}

function selectTab(tabId) {
  selectedTabId = tabId;
  displayTabs();
  updateTabInfo();

  // Clear selected item when tab changes
  selectedItem = null;
  displayToolsList();
  displayResourcesList();

  // Show empty state message
  contentContainerEl.innerHTML = `
    <div class="empty-state">
      <h2>Select from sidebar</h2>
      <p>Choose a tool or resource from the left sidebar</p>
    </div>
  `;

  // Update URL in navigation bar
  const tab = currentTabs.find(t => t.tabId === selectedTabId);
  if (tab && tab.url) {
    const urlInput = document.getElementById('nav-url');
    if (urlInput) {
      urlInput.value = tab.url;
    }
  }
}

function updateTabInfo() {
  const tab = currentTabs.find(t => t.tabId === selectedTabId);

  if (!tab) {
    tabInfoEl.innerHTML = '<span class="info-placeholder">No tab selected</span>';
    return;
  }

  let infoHTML = '';

  // Tab ID
  infoHTML += `<span class="info-item"><span class="info-label">Tab:</span> <span class="info-value">${tab.tabId}</span></span>`;

  // DOM Size
  if (tab.domSize) {
    infoHTML += `<span class="info-item"><span class="info-label">DOM:</span> <span class="info-value">${(tab.domSize / 1024).toFixed(1)} KB</span></span>`;
  }

  // Viewport
  if (tab.viewportDimensions) {
    infoHTML += `<span class="info-item"><span class="info-label">Viewport:</span> <span class="info-value">${tab.viewportDimensions.width}×${tab.viewportDimensions.height}</span></span>`;
  }

  // Page Size
  if (tab.fullPageDimensions) {
    infoHTML += `<span class="info-item"><span class="info-label">Page:</span> <span class="info-value">${tab.fullPageDimensions.width}×${tab.fullPageDimensions.height}</span></span>`;
  }

  // Scroll Position
  if (tab.scrollPosition) {
    infoHTML += `<span class="info-item"><span class="info-label">Scroll:</span> <span class="info-value">${tab.scrollPosition.x}, ${tab.scrollPosition.y}</span></span>`;
  }

  // Page Visibility
  if (tab.pageVisibility) {
    const visibleIcon = tab.pageVisibility.visible ? '👁️' : '🚫';
    infoHTML += `<span class="info-item"><span class="info-label">Visible:</span> <span class="info-value">${visibleIcon} ${tab.pageVisibility.visibilityState}</span></span>`;
  }


  tabInfoEl.innerHTML = infoHTML;
}

// Display tools in sidebar
function displayToolsList() {
  toolsListEl.innerHTML = '';

  if (currentTools.length === 0) {
    toolsListEl.innerHTML = '<div class="empty-state" style="padding: 0.5rem; color: #999;">No tools available</div>';
    return;
  }

  currentTools.forEach(tool => {
    const toolEl = document.createElement('button');
    toolEl.className = 'sidebar-item';
    if (selectedItem && selectedItem.type === 'tool' && selectedItem.name === tool.name) {
      toolEl.classList.add('active');
    }

    // Choose appropriate icon
    let icon = '🔧';
    if (tool.name.includes('click')) icon = '👆';
    else if (tool.name.includes('type')) icon = '⌨️';
    else if (tool.name.includes('screenshot')) icon = '📸';
    else if (tool.name.includes('select')) icon = '📝';
    else if (tool.name.includes('wait')) icon = '⏱️';
    else if (tool.name.includes('execute')) icon = '▶️';
    else if (tool.name.includes('hover')) icon = '🎯';
    else if (tool.name.includes('scroll')) icon = '📜';
    else if (tool.name.includes('navigate')) icon = '🧭';
    else if (tool.name.includes('back')) icon = '⬅️';
    else if (tool.name.includes('forward')) icon = '➡️';

    toolEl.innerHTML = `
      <span class="sidebar-item-icon">${icon}</span>
      <span>${tool.name}</span>
    `;

    toolEl.addEventListener('click', () => selectSidebarItem('tool', tool.name));
    toolsListEl.appendChild(toolEl);
  });
}

// Display resources in sidebar
function displayResourcesList() {
  resourcesListEl.innerHTML = '';

  if (currentResources.length === 0) {
    resourcesListEl.innerHTML = '<div class="empty-state" style="padding: 0.5rem; color: #999;">No resources available</div>';
    return;
  }

  currentResources.forEach(resource => {
    const resourceEl = document.createElement('button');
    resourceEl.className = 'sidebar-item';
    if (selectedItem && selectedItem.type === 'resource' && selectedItem.name === resource.uri) {
      resourceEl.classList.add('active');
    }

    // Choose appropriate icon
    let icon = '📄';
    if (resource.uri.includes('console')) icon = '📋';
    else if (resource.uri.includes('screenshot')) icon = '📸';
    else if (resource.uri.includes('tabs')) icon = '🗂️';

    resourceEl.innerHTML = `
      <span class="sidebar-item-icon">${icon}</span>
      <span>${resource.uri}</span>
    `;

    resourceEl.addEventListener('click', () => selectSidebarItem('resource', resource.uri));
    resourcesListEl.appendChild(resourceEl);
  });
}

// Handle sidebar item selection
function selectSidebarItem(type, name) {
  selectedItem = { type, name };

  // Update active states
  displayToolsList();
  displayResourcesList();

  // Display the selected item in content area
  displaySelectedItem();
}

// Display selected tool or resource
function displaySelectedItem() {
  if (!selectedItem || !selectedTabId) {
    contentContainerEl.innerHTML = `
      <div class="empty-state">
        <h2>Welcome to Kapture Test Client</h2>
        <p>Select a tab from the sidebar to get started</p>
        <p class="hint">Tools and resources will appear once a tab is selected</p>
      </div>
    `;
    return;
  }

  if (selectedItem.type === 'tool') {
    const tool = currentTools.find(t => t.name === selectedItem.name);
    if (tool) {
      // Navigation tools are handled via the navigation bar, not as separate cards
      if (['navigate', 'back', 'forward'].includes(tool.name)) {
        contentContainerEl.innerHTML = `
          <div class="empty-state">
            <h2>${tool.name}</h2>
            <p>${tool.description}</p>
            <p class="hint">Use the navigation bar above to ${tool.name.includes('navigate') ? 'navigate to URLs' : tool.name.includes('back') ? 'go back' : 'go forward'}</p>
          </div>
        `;
      } else {
        contentContainerEl.innerHTML = `
          <div style="max-width: 600px; margin: 0 auto;">
            ${createToolCard(tool)}
          </div>
        `;

        // Restore form data if exists
        if (tabFormData[selectedTabId] && tabFormData[selectedTabId][tool.name]) {
          Object.entries(tabFormData[selectedTabId][tool.name]).forEach(([paramName, value]) => {
            if (paramName === 'format') {
              const radio = document.querySelector(`input[name="${tool.name}-${paramName}"][value="${value}"]`);
              if (radio) radio.checked = true;
            } else {
              const input = document.getElementById(`${tool.name}-${paramName}`);
              if (input) input.value = value;
            }
          });
        }

        // Add event listeners
        addToolEventListeners();
      }
    }
  } else if (selectedItem.type === 'resource') {
    const resource = currentResources.find(r => r.uri === selectedItem.name);
    if (resource) {
      contentContainerEl.innerHTML = `
        <div style="max-width: 600px; margin: 0 auto;">
          ${createResourceCard(resource)}
        </div>
      `;

      // Add event listeners
      addToolEventListeners();
    }
  }
}

// Add navigation event listeners when page loads
function setupNavigationListeners() {
  // Navigation buttons
  document.getElementById('nav-back').addEventListener('click', async () => {
    await executeNavigation('back');
  });

  document.getElementById('nav-forward').addEventListener('click', async () => {
    await executeNavigation('forward');
  });

  const urlInput = document.getElementById('nav-url');
  const navRefresh = document.getElementById('nav-refresh');

  const navigateToUrl = async () => {
    const url = urlInput.value.trim();
    if (url) {
      await executeNavigation('navigate', url);
    }
  };

  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      navigateToUrl();
    }
  });

  navRefresh.addEventListener('click', navigateToUrl);
}

function createToolCard(tool) {
  const params = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];

  // Check if tool has both selector and xpath
  const hasSelectorAndXpath = params.selector && params.xpath;

  const paramsHtml = Object.entries(params)
    .filter(([name]) => name !== 'tabId')
    .map(([name, schema]) => {
      const isRequired = required.includes(name);
      const inputId = `${tool.name}-${name}`;

      let inputHtml = '';
      if (schema.type === 'string' && name === 'code') {
        inputHtml = `<textarea id="${inputId}" ${isRequired ? 'required' : ''}></textarea>`;
      } else if (schema.type === 'number') {
        const min = schema.minimum !== undefined ? `min="${schema.minimum}"` : '';
        const max = schema.maximum !== undefined ? `max="${schema.maximum}"` : '';
        const step = name === 'scale' || name === 'quality' ? 'step="0.1"' : '';
        const defaultValue = schema.default !== undefined ? `value="${schema.default}"` : '';
        inputHtml = `<input type="number" id="${inputId}" ${isRequired ? 'required' : ''} ${min} ${max} ${step} ${defaultValue}>`;
      } else if (name === 'format' && schema.enum) {
        // Create radio buttons for format selection
        inputHtml = `<div class="radio-group">`;
        schema.enum.forEach(format => {
          const isDefault = schema.default === format;
          inputHtml += `
            <label class="radio-label">
              <input type="radio" name="${inputId}" value="${format}" ${isDefault ? 'checked' : ''}>
              <span>${format.toUpperCase()}</span>
            </label>
          `;
        });
        inputHtml += `</div>`;
      } else if (name === 'visible' && schema.enum) {
        // Create dropdown for visibility selection
        inputHtml = `<select id="${inputId}" ${isRequired ? 'required' : ''}>`;
        schema.enum.forEach(option => {
          const isDefault = schema.default === option;
          const label = option === 'true' ? 'Only visible elements' : 
                       option === 'false' ? 'Only hidden elements' : 
                       'All elements';
          inputHtml += `<option value="${option}" ${isDefault ? 'selected' : ''}>${label}</option>`;
        });
        inputHtml += `</select>`;
      } else {
        // Add placeholder hints for selector, xpath, and key fields
        let placeholder = '';
        if (name === 'selector') {
          placeholder = 'placeholder="CSS selector (e.g., button, .class, #id)"';
        } else if (name === 'xpath') {
          placeholder = 'placeholder="XPath (e.g., //button[contains(text(), \'Submit\')])"';
        } else if (name === 'key') {
          placeholder = 'placeholder="e.g., Enter, Control+a, Shift+Tab, Alt+F4"';
        } else if (name === 'delay' && tool.name === 'keypress') {
          placeholder = 'placeholder="50"';
        } else if (name === 'timeout') {
          placeholder = 'placeholder="Auto-calculated based on delay"';
        }
        inputHtml = `<input type="text" id="${inputId}" ${isRequired ? 'required' : ''} ${placeholder}>`;
      }

      return `
        <div class="param-group">
          <label for="${inputId}">
            ${name} ${isRequired ? '<span style="color: #e74c3c;">*</span>' : ''}
          </label>
          ${inputHtml}
        </div>
      `;
    }).join('');

  // Add special help text for keypress tool
  let additionalHelp = '';
  if (tool.name === 'keypress') {
    additionalHelp = `
      <div style="background: #1e2832; padding: 0.75rem; border-radius: 4px; margin-top: 0.5rem; font-size: 0.85rem; color: #ecf0f1; border: 1px solid #34495e;">
        <strong>💡 Tip:</strong> Set delay > 500ms to simulate holding down a key:
        <ul style="margin: 0.5rem 0 0 1.5rem; padding: 0; color: #bdc3c7;">
          <li>1000ms = Hold for 1 second (~30 repeats)</li>
          <li>3000ms = Hold for 3 seconds (~96 repeats)</li>
          <li>Great for: PageDown, Backspace, Arrow keys</li>
        </ul>
        <div style="margin-top: 0.5rem; color: #f39c12;">
          <strong>⚠️ Note:</strong> Long delays require a longer timeout. Leave timeout empty for auto-calculation.
        </div>
      </div>
    `;
  }

  return `
    <div class="tool-card">
      <h3>${escapeHtml(tool.name)}</h3>
      <p class="description">${escapeHtml(tool.description)}</p>
      <div class="tool-params">
        ${paramsHtml || '<p style="color: #999; font-size: 0.85rem;">No parameters needed</p>'}
        ${hasSelectorAndXpath ? '<p style="color: #f39c12; font-size: 0.85rem; margin-top: 0.5rem;"><strong>Note:</strong> Use either selector OR xpath, not both. If both are provided, selector takes precedence.</p>' : ''}
        ${additionalHelp}
      </div>
      <button class="tool-execute" data-tool="${tool.name}">Execute</button>
      <details id="result-${tool.name}" class="tool-result" style="display: none;">
        <summary></summary>
        <pre class="result-content"></pre>
      </details>
    </div>
  `;
}

function createResourceCard(resource) {
  // Check if this is the console resource that supports parameters
  const isConsoleResource = resource.uri.includes('/console');
  const isScreenshotResource = resource.uri.includes('/screenshot');
  const isElementsFromPointResource = resource.uri.includes('/elementsFromPoint');
  const isElementsResource = resource.uri.includes('/elements');
  const isDomResource = resource.uri.includes('/dom');

  let paramsHtml = '';
  if (isConsoleResource) {
    // Add parameter inputs for console resource
    paramsHtml = `
      <div class="tool-params">
        <div class="param-group">
          <label for="${resource.uri}-level">
            level <span style="color: #999; font-size: 0.85rem;">(optional)</span>
          </label>
          <select id="${resource.uri}-level">
            <option value="">All levels</option>
            <option value="log">log</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
        </div>
        <div class="param-group">
          <label for="${resource.uri}-limit">
            limit <span style="color: #999; font-size: 0.85rem;">(optional)</span>
          </label>
          <input type="number" id="${resource.uri}-limit" min="0" max="1000" value="100">
        </div>
        <div class="param-group">
          <label for="${resource.uri}-before">
            before <span style="color: #999; font-size: 0.85rem;">(optional, timestamp)</span>
          </label>
          <input type="text" id="${resource.uri}-before" placeholder="e.g., 2025-06-16T12:00:00.000Z">
        </div>
      </div>
    `;
  } else if (isScreenshotResource) {
    // Add parameter inputs for screenshot resource (same as screenshot tool)
    paramsHtml = `
      <div class="tool-params">
        <div class="param-group">
          <label for="${resource.uri}-selector">
            selector <span style="color: #999; font-size: 0.85rem;">(optional)</span>
          </label>
          <input type="text" id="${resource.uri}-selector" placeholder="CSS selector (e.g., button, .class, #id)">
        </div>
        <div class="param-group">
          <label for="${resource.uri}-xpath">
            xpath <span style="color: #999; font-size: 0.85rem;">(optional, alternative to selector)</span>
          </label>
          <input type="text" id="${resource.uri}-xpath" placeholder="XPath (e.g., //button[contains(text(), 'Submit')])">
        </div>
        <p style="color: #f39c12; font-size: 0.85rem; margin-top: 0.5rem;"><strong>Note:</strong> Use either selector OR xpath, not both. If both are provided, selector takes precedence.</p>
        <div class="param-group">
          <label for="${resource.uri}-scale">
            scale
          </label>
          <input type="number" id="${resource.uri}-scale" min="0.1" max="1.0" step="0.1" value="0.3">
        </div>
        <div class="param-group">
          <label for="${resource.uri}-format">
            format
          </label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="${resource.uri}-format" value="webp" checked>
              <span>WEBP</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="${resource.uri}-format" value="jpeg">
              <span>JPEG</span>
            </label>
            <label class="radio-label">
              <input type="radio" name="${resource.uri}-format" value="png">
              <span>PNG</span>
            </label>
          </div>
        </div>
        <div class="param-group">
          <label for="${resource.uri}-quality">
            quality
          </label>
          <input type="number" id="${resource.uri}-quality" min="0.1" max="1.0" step="0.1" value="0.85">
        </div>
      </div>
    `;
  } else if (isElementsFromPointResource) {
    // Add parameter inputs for elementsFromPoint resource
    paramsHtml = `
      <div class="tool-params">
        <div class="param-group">
          <label for="${resource.uri}-x">
            x <span style="color: #f56565;">*</span>
          </label>
          <input type="number" id="${resource.uri}-x" required>
        </div>
        <div class="param-group">
          <label for="${resource.uri}-y">
            y <span style="color: #f56565;">*</span>
          </label>
          <input type="number" id="${resource.uri}-y" required>
        </div>
      </div>
    `;
  } else if (isElementsResource) {
    // Add parameter inputs for elements resource
    paramsHtml = `
      <div class="tool-params">
        <div class="param-group">
          <label for="${resource.uri}-selector">
            selector <span style="color: #999; font-size: 0.85rem;">(optional)</span>
          </label>
          <input type="text" id="${resource.uri}-selector" placeholder="CSS selector (e.g., button, .class, #id)">
        </div>
        <div class="param-group">
          <label for="${resource.uri}-xpath">
            xpath <span style="color: #999; font-size: 0.85rem;">(optional, alternative to selector)</span>
          </label>
          <input type="text" id="${resource.uri}-xpath" placeholder="XPath (e.g., //button[contains(text(), 'Submit')])">
        </div>
        <div class="param-group">
          <label for="${resource.uri}-visible">
            visible <span style="color: #999; font-size: 0.85rem;">(optional)</span>
          </label>
          <select id="${resource.uri}-visible">
            <option value="all" selected>All elements</option>
            <option value="true">Only visible elements</option>
            <option value="false">Only hidden elements</option>
          </select>
        </div>
        <p style="color: #f39c12; font-size: 0.85rem; margin-top: 0.5rem;"><strong>Note:</strong> Use either selector OR xpath, not both. If both are provided, selector takes precedence.</p>
      </div>
    `;
  } else if (isDomResource) {
    // Add parameter inputs for DOM resource
    paramsHtml = `
      <div class="tool-params">
        <div class="param-group">
          <label for="${resource.uri}-selector">
            selector <span style="color: #999; font-size: 0.85rem;">(optional, defaults to body)</span>
          </label>
          <input type="text" id="${resource.uri}-selector" placeholder="CSS selector (e.g., body, .content, #main)">
        </div>
        <div class="param-group">
          <label for="${resource.uri}-xpath">
            xpath <span style="color: #999; font-size: 0.85rem;">(optional, alternative to selector)</span>
          </label>
          <input type="text" id="${resource.uri}-xpath" placeholder="XPath (e.g., //div[@class='content'])">
        </div>
        <p style="color: #f39c12; font-size: 0.85rem; margin-top: 0.5rem;"><strong>Note:</strong> Use either selector OR xpath, not both. If both are provided, selector takes precedence.</p>
      </div>
    `;
  }

  return `
    <div class="tool-card">
      <h3>${resource.uri}</h3>
      <p class="description">${resource.description || resource.name}</p>
      ${paramsHtml}
      <button class="tool-execute resource-query" data-resource="${resource.uri}">Query Resource</button>
      <details id="result-${resource.uri.replace(/[^a-zA-Z0-9]/g, '-')}" class="tool-result" style="display: none;">
        <summary></summary>
        <pre class="result-content"></pre>
      </details>
    </div>
  `;
}

function addToolEventListeners() {
  // Save form data on input
  contentContainerEl.querySelectorAll('input, textarea').forEach(input => {
    const eventType = input.type === 'radio' ? 'change' : 'input';
    input.addEventListener(eventType, () => {
      if (input.type === 'radio') {
        // For radio buttons, extract tool and param name from the name attribute
        const [toolName, paramName] = input.name.split('-');
        if (!tabFormData[selectedTabId]) {
          tabFormData[selectedTabId] = {};
        }
        if (!tabFormData[selectedTabId][toolName]) {
          tabFormData[selectedTabId][toolName] = {};
        }
        tabFormData[selectedTabId][toolName][paramName] = input.value;
      } else {
        // For other inputs, use the id attribute
        const [toolName, paramName] = input.id.split('-');
        if (!tabFormData[selectedTabId]) {
          tabFormData[selectedTabId] = {};
        }
        if (!tabFormData[selectedTabId][toolName]) {
          tabFormData[selectedTabId][toolName] = {};
        }
        tabFormData[selectedTabId][toolName][paramName] = input.value;
      }
    });
  });

  // Execute buttons
  contentContainerEl.querySelectorAll('.tool-execute').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const toolName = e.target.dataset.tool;
      await executeTool(toolName, e.target);
    });
  });

  // Resource query buttons
  contentContainerEl.querySelectorAll('.resource-query').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const resourceUri = e.target.dataset.resource;
      await queryResource(resourceUri, e.target);
    });
  });
}

async function executeTool(toolName, button) {
  const tool = currentTools.find(t => t.name === toolName);
  if (!tool) return;

  const resultEl = document.getElementById(`result-${toolName}`);
  const summaryEl = resultEl.querySelector('summary');
  const contentEl = resultEl.querySelector('.result-content');

  try {
    // Check if tab is selected
    if (!selectedTabId) {
      throw new Error('Please select a tab first');
    }

    button.disabled = true;
    button.textContent = 'Executing...';
    resultEl.style.display = 'block';
    resultEl.open = true; // Auto-open the details
    resultEl.className = 'tool-result';
    summaryEl.textContent = 'Executing...';
    contentEl.textContent = '';

    // Gather parameters
    const params = { tabId: selectedTabId };

    const paramProps = tool.inputSchema?.properties || {};
    Object.keys(paramProps).forEach(name => {
      if (name === 'tabId') return;

      if (name === 'format' && paramProps[name].enum) {
        // For radio buttons, find the checked one
        const checkedRadio = document.querySelector(`input[name="${toolName}-${name}"]:checked`);
        if (checkedRadio) {
          params[name] = checkedRadio.value;
        }
      } else {
        const input = document.getElementById(`${toolName}-${name}`);
        if (input && input.value) {
          if (paramProps[name].type === 'number') {
            params[name] = parseFloat(input.value);
          } else {
            params[name] = input.value;
          }
        }
      }
    });

    log(`Executing ${toolName} with params: ${JSON.stringify(params)}`);

    const result = await callTool(toolName, params);

    resultEl.className = 'tool-result success';

    // Parse and display result
    if (result.content && result.content.length > 0) {
      // Check if we have multiple content items (e.g., screenshot with both image and JSON)
      const hasMultipleContent = result.content.length > 1;
      const imageContent = result.content.find(c => c.type === 'image');
      const textContent = result.content.find(c => c.type === 'text');

      if (hasMultipleContent && imageContent && textContent) {
        // Handle screenshot tool with both image and JSON response
        summaryEl.textContent = '✅ Screenshot captured';

        // Display the JSON response in the content area
        let jsonData;
        try {
          jsonData = JSON.parse(textContent.text);
          contentEl.textContent = JSON.stringify(jsonData, null, 2);
        } catch (e) {
          contentEl.textContent = textContent.text;
        }

        // Create a preview section for the image OUTSIDE the details section
        const previewDiv = document.createElement('div');
        previewDiv.className = 'screenshot-preview';

        const img = document.createElement('img');
        img.src = `data:${imageContent.mimeType};base64,${imageContent.data}`;

        previewDiv.appendChild(img);
        // Append the preview after the result details element
        resultEl.appendChild(previewDiv);
      } else if (result.content[0].type === 'image') {
        // Handle image-only response
        const responseContent = result.content[0];
        summaryEl.textContent = '✅ Screenshot captured';

        // Create an image element to display the screenshot
        const img = document.createElement('img');
        img.src = `data:${responseContent.mimeType};base64,${responseContent.data}`;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';

        contentEl.innerHTML = '';
        contentEl.appendChild(img);
      } else if (result.content[0].type === 'text') {
        const responseContent = result.content[0];
        // Handle text/JSON responses
        let content;
        try {
          content = JSON.parse(responseContent.text);
        } catch (parseError) {
          // If JSON parsing fails, it might be a plain error message
          throw new Error(responseContent.text || 'Unknown error');
        }

        // Set summary based on content
        if (content.error) {
          summaryEl.textContent = `❌ ${content.error.message || 'Command failed'}`;
          resultEl.className = 'tool-result error';
        } else if (content.clicked === false || content.hovered === false || content.filled === false || content.selected === false) {
          summaryEl.textContent = '⚠️ Element not found';
          resultEl.className = 'tool-result warning';
        } else if (toolName === 'screenshot') {
          summaryEl.textContent = '✅ Screenshot captured';
        } else if (toolName === 'click') {
          summaryEl.textContent = '✅ Clicked successfully';
        } else if (toolName === 'hover') {
          summaryEl.textContent = '✅ Hovered successfully';
        } else if (toolName === 'fill') {
          summaryEl.textContent = '✅ Filled successfully';
        } else if (toolName === 'select') {
          summaryEl.textContent = '✅ Selected successfully';
        } else if (toolName === 'logs') {
          summaryEl.textContent = `✅ Retrieved ${content.logs?.length || 0} logs`;
        } else if (toolName === 'dom') {
          summaryEl.textContent = '✅ DOM retrieved';
        } else if (toolName === 'keypress') {
          if (content.autoRepeat && content.repeatCount) {
            summaryEl.textContent = `✅ Key pressed with ${content.repeatCount} repeats`;
          } else {
            summaryEl.textContent = '✅ Key pressed successfully';
          }
        } else {
          summaryEl.textContent = '✅ Success';
        }

        contentEl.textContent = JSON.stringify(content, null, 2);

        // Update local tab info if we got new URL/title
        if (content.url && content.title && selectedTabId) {
          const tab = currentTabs.find(t => t.tabId === selectedTabId);
          if (tab && (tab.url !== content.url || tab.title !== content.title)) {
            tab.url = content.url;
            tab.title = content.title;

            // Update UI immediately
            displayTabs();

            // Update URL input if it exists
            const urlInput = document.getElementById('nav-url');
            if (urlInput) {
              urlInput.value = content.url;
            }

            log(`Tab info updated: ${content.title}`);
          }
        }

        // Special handling for screenshots
        if (content.dataUrl) {
          // Remove any existing screenshot preview
          const existingPreview = resultEl.parentNode.querySelector('.screenshot-preview');
          if (existingPreview) {
            existingPreview.remove();
          }

          const img = document.createElement('div');
          img.className = 'screenshot-preview';
          const scaleInfo = content.scale && content.scale < 1 ? ` (scaled to ${content.scale * 100}%)` : '';
          const formatInfo = content.format ? ` (${content.format.toUpperCase()})` : '';
          img.innerHTML = `
            <img src="${content.dataUrl}" alt="Screenshot">
            <div style="text-align: center; margin-top: 0.5rem; font-size: 0.85rem; color: #666;">
              Screenshot captured${scaleInfo}${formatInfo}
            </div>
          `;
          // Insert after the details element
          resultEl.parentNode.insertBefore(img, resultEl.nextSibling);
        }
      } else if (result.content[0].type === 'error') {
        throw new Error(result.content[0].text || 'Unknown error');
      } else {
        throw new Error(`Unsupported content type: ${result.content[0].type}`);
      }
    } else {
      summaryEl.textContent = '✅ Success';
      contentEl.textContent = JSON.stringify(result, null, 2);
    }

    log(`${toolName} executed successfully`);
  } catch (error) {
    resultEl.className = 'tool-result error';
    let errorMessage = error.message;

    // Check for common error patterns
    if (errorMessage.includes('Tab') && errorMessage.includes('not found')) {
      errorMessage = 'Tab not found. Please refresh tabs and try again.';
    } else if (errorMessage.includes('not connected')) {
      errorMessage = 'MCP server not connected. Please connect first.';
    } else if (errorMessage.includes('Please select a tab first')) {
      errorMessage = 'No tab selected. Please select a tab from the list above.';
    }

    summaryEl.textContent = `❌ ${errorMessage}`;
    contentEl.textContent = error.stack || error.message;
    log(`${toolName} failed: ${errorMessage}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Execute';
  }
}

async function callTool(name, args) {
  return await window.electronAPI.sendMCPRequest('tools/call', {
    name,
    arguments: args
  });
}

async function queryResource(resourceUri, button) {
  const resultId = `result-${resourceUri.replace(/[^a-zA-Z0-9]/g, '-')}`;
  const resultEl = document.getElementById(resultId);
  const summaryEl = resultEl.querySelector('summary');
  const contentEl = resultEl.querySelector('.result-content');

  try {
    button.disabled = true;
    button.textContent = 'Querying...';
    resultEl.style.display = 'block';
    resultEl.open = true; // Auto-open the details
    resultEl.className = 'tool-result';
    summaryEl.textContent = 'Querying...';
    contentEl.textContent = '';

    // Build URI with query parameters
    let finalUri = resourceUri;
    const params = new URLSearchParams();

    if (resourceUri.includes('/console')) {
      const levelInput = document.getElementById(`${resourceUri}-level`);
      const limitInput = document.getElementById(`${resourceUri}-limit`);
      const beforeInput = document.getElementById(`${resourceUri}-before`);

      if (levelInput && levelInput.value) {
        params.append('level', levelInput.value);
      }
      if (limitInput && limitInput.value) {
        params.append('limit', limitInput.value);
      }
      if (beforeInput && beforeInput.value) {
        params.append('before', beforeInput.value);
      }
    } else if (resourceUri.includes('/screenshot')) {
      const selectorInput = document.getElementById(`${resourceUri}-selector`);
      const xpathInput = document.getElementById(`${resourceUri}-xpath`);
      const scaleInput = document.getElementById(`${resourceUri}-scale`);
      const formatRadio = document.querySelector(`input[name="${resourceUri}-format"]:checked`);
      const qualityInput = document.getElementById(`${resourceUri}-quality`);

      if (selectorInput && selectorInput.value) {
        params.append('selector', selectorInput.value);
      }
      if (xpathInput && xpathInput.value && !(selectorInput && selectorInput.value)) {
        params.append('xpath', xpathInput.value);
      }
      if (scaleInput && scaleInput.value) {
        params.append('scale', scaleInput.value);
      }
      if (formatRadio) {
        params.append('format', formatRadio.value);
      }
      if (qualityInput && qualityInput.value) {
        params.append('quality', qualityInput.value);
      }
    } else if (resourceUri.includes('/elementsFromPoint')) {
      const xInput = document.getElementById(`${resourceUri}-x`);
      const yInput = document.getElementById(`${resourceUri}-y`);

      if (xInput && xInput.value) {
        params.append('x', xInput.value);
      }
      if (yInput && yInput.value) {
        params.append('y', yInput.value);
      }
    } else if (resourceUri.includes('/elements')) {
      const selectorInput = document.getElementById(`${resourceUri}-selector`);
      const xpathInput = document.getElementById(`${resourceUri}-xpath`);
      const visibleInput = document.getElementById(`${resourceUri}-visible`);

      if (selectorInput && selectorInput.value) {
        params.append('selector', selectorInput.value);
      }
      if (xpathInput && xpathInput.value && !(selectorInput && selectorInput.value)) {
        params.append('xpath', xpathInput.value);
      }
      if (visibleInput && visibleInput.value) {
        params.append('visible', visibleInput.value);
      }
    } else if (resourceUri.includes('/dom')) {
      const selectorInput = document.getElementById(`${resourceUri}-selector`);
      const xpathInput = document.getElementById(`${resourceUri}-xpath`);

      if (selectorInput && selectorInput.value) {
        params.append('selector', selectorInput.value);
      }
      if (xpathInput && xpathInput.value && !(selectorInput && selectorInput.value)) {
        params.append('xpath', xpathInput.value);
      }
    }

    if (params.toString()) {
      finalUri += '?' + params.toString();
    }

    const response = await window.electronAPI.sendMCPRequest('resources/read', {
      uri: finalUri
    });

    // Display the result
    if (response.contents && response.contents[0]) {
      const data = JSON.parse(response.contents[0].text);

      resultEl.className = 'tool-result success';

      // Set summary based on content
      if (resourceUri.includes('/console')) {
        const logCount = data.logs ? data.logs.length : 0;
        const totalCount = data.total || 0;
        summaryEl.textContent = `✅ Retrieved ${logCount} of ${totalCount} logs`;
        contentEl.textContent = JSON.stringify(data, null, 2);
      } else if (resourceUri.includes('/tabs')) {
        const tabCount = Array.isArray(data) ? data.length : 0;
        summaryEl.textContent = `✅ Found ${tabCount} tabs`;
        contentEl.textContent = JSON.stringify(data, null, 2);
      } else if (resourceUri.includes('/screenshot')) {
        summaryEl.textContent = '✅ Screenshot captured';

        // Display the raw JSON in the result content
        contentEl.textContent = JSON.stringify(data, null, 2);

        // Create screenshot preview below the result
        if (data.screenshot && data.screenshot.dataUrl) {
          // Remove any existing screenshot preview
          const existingPreview = resultEl.parentNode.querySelector('.screenshot-preview');
          if (existingPreview) {
            existingPreview.remove();
          }

          const previewDiv = document.createElement('div');
          previewDiv.className = 'screenshot-preview';
          const scaleInfo = data.parameters && data.parameters.scale < 1 ? ` (scaled to ${Math.round(data.parameters.scale * 100)}%)` : '';
          const formatInfo = data.parameters && data.parameters.format ? ` (${data.parameters.format.toUpperCase()})` : '';
          previewDiv.innerHTML = `
            <img src="${data.screenshot.dataUrl}" alt="Screenshot">
            <div style="text-align: center; margin-top: 0.5rem; font-size: 0.85rem; color: #666;">
              Screenshot captured${scaleInfo}${formatInfo}
            </div>
          `;
          // Insert after the details element
          resultEl.parentNode.insertBefore(previewDiv, resultEl.nextSibling);
        }
      } else {
        summaryEl.textContent = '✅ Resource retrieved';
        contentEl.textContent = JSON.stringify(data, null, 2);
      }
    } else {
      resultEl.className = 'tool-result warning';
      summaryEl.textContent = '⚠️ No data returned';
      contentEl.textContent = 'The resource returned no content';
    }

    log(`Successfully queried resource: ${finalUri}`, 'info');
  } catch (error) {
    resultEl.className = 'tool-result error';
    summaryEl.textContent = `❌ ${error.message}`;
    contentEl.textContent = error.stack || error.message;
    log(`Failed to query resource ${resourceUri}: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Query Resource';
  }
}

// Execute navigation commands
async function executeNavigation(action, url = null) {
  try {
    let toolName, params;

    switch (action) {
      case 'back':
        toolName = 'back';
        params = { tabId: selectedTabId };
        log('Navigating back...');
        break;
      case 'forward':
        toolName = 'forward';
        params = { tabId: selectedTabId };
        log('Navigating forward...');
        break;
      case 'navigate':
        toolName = 'navigate';
        params = { tabId: selectedTabId, url };
        log(`Navigating to ${url}...`);
        break;
    }

    const result = await callTool(toolName, params);
    const content = JSON.parse(result.content[0].text);

    if (content.error) {
      log(`Navigation failed: ${content.error.message}`, 'error');
    } else {
      log(`Navigation completed`);

      // Update local tab info if we got new URL/title
      if (content.url && content.title) {
        const tab = currentTabs.find(t => t.tabId === selectedTabId);
        if (tab) {
          tab.url = content.url;
          tab.title = content.title;

          // Update UI immediately
          displayTabs();

          // Update URL input
          const urlInput = document.getElementById('nav-url');
          if (urlInput) {
            urlInput.value = content.url;
          }
        }
      }
    }
  } catch (error) {
    log(`Navigation error: ${error.message}`, 'error');
  }
}

// Clear console
document.getElementById('clear-console').addEventListener('click', () => {
  consoleEl.innerHTML = '';
});

// Listen for MCP notifications
window.electronAPI.onMCPNotification((message) => {
  if (message.method === 'log' && message.params) {
    log(message.params.message, message.params.type || 'info');
  } else if (message.method === 'kapture/tab_disconnected' && message.params) {
    // Handle tab disconnection notification
    const { tabId } = message.params;
    log(`Tab ${tabId} disconnected`, 'warning');

    // Remove tab from current tabs
    currentTabs = currentTabs.filter(tab => tab.tabId !== tabId);

    // If this was the selected tab, clear selection
    if (selectedTabId === tabId) {
      selectedTabId = null;
      displayTabContent();
      updateTabInfo();
    }

    // Update UI
    displayTabs();
  } else if (message.method === 'kapture/tabs_changed' && message.params) {
    // Handle tabs list change notification
    const { tabs } = message.params;
    log(`Tabs list changed: ${tabs.length} tabs`, 'info');

    // Debug: Log the full tab data
    if (tabs.length > 0) {
      log(`Tab data received: ${JSON.stringify(tabs)}`, 'debug');
    }

    // Update current tabs
    currentTabs = tabs;

    // Update UI
    displayTabs();

    // If no tab selected and we have tabs, select the first one
    if (!selectedTabId && currentTabs.length > 0) {
      selectTab(currentTabs[0].tabId);
    }

    // If selected tab is gone, clear selection
    if (selectedTabId && !currentTabs.find(t => t.tabId === selectedTabId)) {
      selectedTabId = null;
      displayTabContent();
      updateTabInfo();
    } else if (selectedTabId) {
      // Update tab info if selected tab still exists
      updateTabInfo();

      // Update URL in navigation bar if the selected tab's URL changed
      const selectedTab = currentTabs.find(t => t.tabId === selectedTabId);
      if (selectedTab && selectedTab.url) {
        const urlInput = document.getElementById('nav-url');
        if (urlInput) {
          urlInput.value = selectedTab.url;
        }
      }
    }
  } else if (message.method === 'kapture/console_log' && message.params) {
    // Handle real-time console log notification
    const { tabId, logEntry } = message.params;
    const tabName = currentTabs.find(t => t.tabId === tabId)?.title || tabId;
    log(`[${tabName}] Console ${logEntry.level}: ${logEntry.message}`, logEntry.level);
  } else if (message.method === 'notifications/resources/list_changed') {
    // Handle resources list changed notification
    log('Resources list changed, refreshing...', 'info');
    discoverResources().then(() => {
      // Update UI if we have a selected tab
      if (selectedTabId) {
        displayTabContent();
      }
    });
  } else {
    log(`Notification: ${message.method}`, 'info');
  }
});

window.electronAPI.onMCPDisconnected((data) => {
  log(`MCP WebSocket disconnected (code: ${data.code})`, 'warning');
  connected = false;
  statusEl.classList.remove('connected');
  statusTextEl.textContent = 'Reconnecting...';
  refreshTabsBtn.disabled = true;

  // Don't clear data during reconnection - we'll restore state when reconnected
  contentContainerEl.innerHTML = `
    <div class="empty-state">
      <h2>Reconnecting...</h2>
      <p>Connection lost. Attempting to reconnect to server...</p>
    </div>
  `;
});

window.electronAPI.onMCPError((data) => {
  if (data.type === 'PORT_IN_USE') {
    log(data.message, 'error');
    alert('Port 61822 is already in use!\n\nPlease stop any running Kapture server instances:\n- Check for other terminal windows running "npm start"\n- Check for other Electron test app instances\n- Use "lsof -i :61822" to find the process');
    connected = false;
    statusEl.classList.remove('connected');
    statusTextEl.textContent = 'Port In Use';
    refreshTabsBtn.disabled = true;
  } else if (data.type === 'WEBSOCKET_ERROR') {
    log(`WebSocket error: ${data.message}`, 'error');
  } else {
    log(`Server error: ${data.message}`, 'error');
  }
});

// Handle successful reconnection
window.electronAPI.onMCPReconnected(() => {
  log('Successfully reconnected to MCP server!', 'info');
  connected = true;
  statusEl.classList.add('connected');

  const port = window.electronAPI.getPort().then(port => {
    statusTextEl.textContent = `Connected to MCP (ws://localhost:${port}/mcp)`;
  });

  refreshTabsBtn.disabled = false;

  // Re-discover tools and resources
  Promise.all([
    discoverTools(),
    discoverResources()
  ]).then(() => {
    log('Re-discovered tools and resources', 'info');

    // Restore UI state if we had a selected tab
    if (selectedTabId && currentTabs.find(t => t.tabId === selectedTabId)) {
      displayTabContent();
    } else {
      contentContainerEl.innerHTML = `
        <div class="empty-state">
          <h2>Select a Tab</h2>
          <p>Choose a browser tab from above to see available tools</p>
        </div>
      `;
    }
  });
});

// Draggable console setup
let isDragging = false;
let startY = 0;
let startHeight = 0;

consoleDividerEl.addEventListener('mousedown', (e) => {
  isDragging = true;
  startY = e.clientY;
  startHeight = consoleContainerEl.offsetHeight;
  consoleDividerEl.classList.add('dragging');
  document.body.style.cursor = 'ns-resize';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;

  const deltaY = startY - e.clientY;
  const newHeight = Math.max(50, Math.min(window.innerHeight - 200, startHeight + deltaY));
  consoleContainerEl.style.height = newHeight + 'px';
});

document.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    consoleDividerEl.classList.remove('dragging');
    document.body.style.cursor = '';
  }
});

// Initial state
log('Kapture MCP Test Client ready');

// Setup navigation listeners
setupNavigationListeners();

// Auto-connect on startup
connectToServer();
