var host = window.location.hostname; 
var port = window.location.port;
var protocol = window.location.protocol;
var path = window.location.pathname;
var socket = io(protocol + '//' + host + ':' + port, { path: path + '/socket.io'});

// Show loading indicator
function showLoading() {
  $('#filebrowser').empty();
  $('#filebrowser').append($('<div>').attr('id','loading').append(
    $('<div>').addClass('loading-spinner')
  ));
}

// Open default folder on connect
socket.on('connect',function(){
  showLoading();
  socket.emit('open', '');
});

// Get file list
function getFiles(directory) {
  directory = directory.replace("//","/");
  directory = directory.replace("|","'");
  let directoryClean = directory.replace("'","|");
  if ((directory !== '/') && (directory.endsWith('/'))) {
    directory = directory.slice(0, -1);
  }
  showLoading();
  socket.emit('getfiles', directory);
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Global variables for sorting
let currentSortColumn = null;
let currentSortDirection = 'asc';
let currentDirs = [];
let currentFiles = [];

// Format date for display
function formatDate(date) {
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(date).toLocaleDateString('en-US', options);
}

// Sort function for files and directories
function sortItems(items, column, direction) {
  return items.sort((a, b) => {
    let valueA, valueB;
    
    if (column === 'name') {
      valueA = (typeof a === 'string' ? a : a.name).toLowerCase();
      valueB = (typeof b === 'string' ? b : b.name).toLowerCase();
    } else if (column === 'modified') {
      // Handle items without modification time (like strings)
      if (typeof a === 'string' || typeof b === 'string') {
        return 0; // Keep original order for items without modification time
      }
      valueA = new Date(a.modified);
      valueB = new Date(b.modified);
    } else {
      return 0;
    }
    
    if (direction === 'asc') {
      return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
    } else {
      return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
    }
  });
}

// Re-render the table with current sort
function rerenderTable() {
  let directory = $('#filebrowser').data('directory');
  let directoryClean = directory.replace("'","|");
  if (directoryClean == '/') {
    directoryClean = '';
  }
  
  // Sort the current data
  let sortedDirs = [...currentDirs];
  let sortedFiles = [...currentFiles];
  
  if (currentSortColumn) {
    sortedDirs = sortItems(sortedDirs, currentSortColumn, currentSortDirection);
    sortedFiles = sortItems(sortedFiles, currentSortColumn, currentSortDirection);
  }
  
  // Find the table and clear existing rows (except header)
  let table = $('.fileTable');
  table.find('tr:not(:first)').remove();
  
  // Add parent directory row only if not in home directory (/config)
  if (directory !== '/config') {
    let parentRow = $('<tr>');
    let parentLink = $('<td>').addClass('directory back-link')
      .attr('onclick', 'getFiles(\'' + directory.replace(directory.split('/').slice(-1)[0],'').replace(/\/$/, '') + '\');')
      .text('Back');
    let parentType = $('<td>').text('Parent');
    let parentModified = $('<td>').text('-');
    let parentDownload = $('<td>').text('-');
    let parentDelete = $('<td>').text('-');
    for (let item of [parentLink, parentType, parentModified, parentDownload, parentDelete]) {
      parentRow.append(item);
    }
    table.append(parentRow);
  }
  
  // Add directories
  if (sortedDirs.length > 0) {
    for (let dir of sortedDirs) {
      let tableRow = $('<tr>');
      let dirName = typeof dir === 'string' ? dir : dir.name;
      let dirModified = typeof dir === 'string' ? '-' : formatDate(dir.modified);
      let dirClean = dirName.replace("'","|");
      let link = $('<td>').addClass('directory')
        .attr('onclick', 'getFiles(\'' + directoryClean + '/' + dirClean + '\');')
        .text(dirName);
      let type = $('<td>').text('Folder');
      let modified = $('<td>').text(dirModified);
      let download = $('<td>').append(
        $('<button>').addClass('download-button').text('Download')
          .click(function() {
            downloadFile(directoryClean + '/' + dirClean);
          })
      );
      let deleteBtn = $('<td>').append(
        $('<button>').addClass('delete-button').text('Delete')
          .click(function() {
            deleter(directoryClean + '/' + dirClean);
          })
      );
      for (let item of [link, type, modified, download, deleteBtn]) {
        tableRow.append(item);
      }
      table.append(tableRow);
    }
  }
  
  // Add files
  if (sortedFiles.length > 0) {
    for (let file of sortedFiles) {
      let tableRow = $('<tr>');
      let fileName = typeof file === 'string' ? file : file.name;
      let fileModified = typeof file === 'string' ? '-' : formatDate(file.modified);
      let fileClean = fileName.replace("'","|");
      let link = $('<td>').addClass('file').text(fileName);
      let type = $('<td>').text('File');
      let modified = $('<td>').text(fileModified);
      let download = $('<td>').append(
        $('<button>').addClass('download-button').text('Download')
          .click(function() {
            downloadFile(directoryClean + '/' + fileClean);
          })
      );
      let deleteBtn = $('<td>').append(
        $('<button>').addClass('delete-button').text('Delete')
          .click(function() {
            deleter(directoryClean + '/' + fileClean);
          })
      );
      for (let item of [link, type, modified, download, deleteBtn]) {
        tableRow.append(item);
      }
      table.append(tableRow);
    }
  }
  
  // Show empty state if no files or directories
  if (sortedDirs.length === 0 && sortedFiles.length === 0) {
    let emptyRow = $('<tr>');
    let emptyCell = $('<td>')
      .attr('colspan', '5')
      .css({
        'text-align': 'center',
        'padding': '40px 20px',
        'color': '#999 !important'
      })
      .text('This folder is empty');
    emptyRow.append(emptyCell);
    table.append(emptyRow);
  }
}

// Download a file
function downloadFile(file) {
  file = file.replace("|","'");
  window.location.href = './download?path=' + encodeURIComponent(file);
}

// Upload files to current directory
async function upload(input) {
  let directory = $('#filebrowser').data('directory');
  if (directory == '/') {
    directoryUp = '';
  } else {
    directoryUp = directory;
  }
  if (input.files && input.files[0]) {
    let progressContainer = $('<div>')
      .attr('id', 'upload-progress-container')
      .css({
        'position': 'fixed',
        'bottom': '20px',
        'right': '20px',
        'background': 'white',
        'border-radius': '4px',
        'padding': '15px',
        'box-shadow': '0 2px 15px rgba(0,0,0,0.1)',
        'z-index': '1000',
        'width': '300px'
      });
    
    $('body').append(progressContainer);
    for (let file of input.files) {
      let progressItem = $('<div>')
        .addClass('upload-item')
        .css({
          'margin-bottom': '10px',
          'font-size': '13px'
        });
      
      let fileName = $('<div>')
        .text(file.name)
        .css({
          'margin-bottom': '5px',
          'font-weight': '500',
          'white-space': 'nowrap',
          'overflow': 'hidden',
          'text-overflow': 'ellipsis'
        });
      
      let progressBar = $('<div>')
        .addClass('progress-bar-container')
        .css({
          'height': '6px',
          'background': '#eee',
          'border-radius': '3px',
          'overflow': 'hidden'
        });
      
      let progress = $('<div>')
        .addClass('progress')
        .css({
          'height': '100%',
          'background': 'var(--primary-color)',
          'width': '0%',
          'transition': 'width 0.3s'
        });

      progressBar.append(progress);
      progressItem.append(fileName, progressBar);
      progressContainer.append(progressItem);

      let formData = new FormData();
      formData.append('file', file);
      formData.append('directory', directoryUp);
      let xhr = new XMLHttpRequest();
      xhr.open('POST', './upload');
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          let percentLoaded = Math.round((e.loaded / e.total) * 100);
          progress.css('width', percentLoaded + '%');
        }
      };
      xhr.onload = function() {
        if (xhr.status === 200) {
          progress.css('width', '100%');
          setTimeout(function() {
            progressItem.fadeOut(function() {
              $(this).remove();
              if (progressContainer.children().length === 0) {
                progressContainer.fadeOut(function() {
                  $(this).remove();
                });
              }
            });
          }, 500);
          getFiles(directory);
        } else {
          // handle error
          progressItem.css('color', 'red');
          fileName.text(fileName.text() + ' - Upload Failed');
        }
      };
      xhr.send(formData);
    }
    // Clear the file input value to allow re-uploading the same file
    $(input).val('');
  }
}

// Delete file/folder
function deleter(item) {
  let directory = $('#filebrowser').data('directory');
  showLoading();
  socket.emit('deletefiles', [item, directory]);
}

// Create folder
function createFolder() {
  let directory = $('#filebrowser').data('directory');
  if (directory == '/') {
    directoryUp = '';
  } else {
    directoryUp = directory;
  }
  let folderName = $('#folderName').val();
  $('#folderName').val('');
  if ((folderName.length == 0) || (folderName.includes('/'))) {
    alert('Please enter a valid folder name');
    return '';
  }
  showLoading();
  socket.emit('createfolder', [directoryUp + '/' + folderName, directory]);
}

// Handle drag and drop
async function dropFiles(ev) {
  ev.preventDefault();
  showLoading();
  $('#dropzone').css({'visibility':'hidden','opacity':0});
  let directory = $('#filebrowser').data('directory');
  if (directory == '/') {
    directoryUp = '';
  } else {
    directoryUp = directory;
  }
  
  // Create upload progress container
  let progressContainer = $('<div>')
    .attr('id', 'upload-progress-container')
    .css({
      'position': 'fixed',
      'bottom': '20px',
      'right': '20px',
      'background': 'white',
      'border-radius': '4px',
      'padding': '15px',
      'box-shadow': '0 2px 15px rgba(0,0,0,0.1)',
      'z-index': '1000',
      'width': '300px'
    });
  
  $('body').append(progressContainer);
  
  let items = await getAllFileEntries(event.dataTransfer.items);
  for await (let item of items) {
    let fullPath = item.fullPath;
    item.file(async function(file) {
      // Create progress item for this file
      let progressItem = $('<div>')
        .addClass('upload-item')
        .css({
          'margin-bottom': '10px',
          'font-size': '13px'
        });
      
      let fileName = $('<div>')
        .text(file.name)
        .css({
          'margin-bottom': '5px',
          'font-weight': '500',
          'white-space': 'nowrap',
          'overflow': 'hidden',
          'text-overflow': 'ellipsis'
        });
      
      let progressBar = $('<div>')
        .addClass('progress-bar-container')
        .css({
          'height': '6px',
          'background': '#eee',
          'border-radius': '3px',
          'overflow': 'hidden'
        });
      
      let progress = $('<div>')
        .addClass('progress')
        .css({
          'height': '100%',
          'background': 'var(--primary-color)',
          'width': '0%',
          'transition': 'width 0.3s'
        });
      
      progressBar.append(progress);
      progressItem.append(fileName, progressBar);
      progressContainer.append(progressItem);
      
      let reader = new FileReader();
      reader.onload = async function(e) {
        progress.css('width', '100%');
        let fileName = file.name;
        if (e.total < 200000000) {
          let data = e.target.result;
          if (item == items[items.length - 1]) {
            socket.emit('uploadfile', [directory, directoryUp + '/' + fullPath, data, true]);
            
            // Remove progress container after 1 second
            setTimeout(function() {
              progressContainer.fadeOut(function() {
                $(this).remove();
              });
            }, 1000);
          } else {
            socket.emit('uploadfile', [directory, directoryUp + '/' + fullPath, data, false]);
          }
        } else {
          progressItem.css('color', 'red');
          fileName.text(fileName.text() + ' - File too big');
          await new Promise(resolve => setTimeout(resolve, 2000));
          socket.emit('getfiles', directory);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }
}

// Drop handler function to get all files
async function getAllFileEntries(dataTransferItemList) {
  let fileEntries = [];
  // Use BFS to traverse entire directory/file structure
  let queue = [];
  // Unfortunately dataTransferItemList is not iterable i.e. no forEach
  for (let i = 0; i < dataTransferItemList.length; i++) {
    queue.push(dataTransferItemList[i].webkitGetAsEntry());
  }
  while (queue.length > 0) {
    let entry = queue.shift();
    if (entry.isFile) {
      fileEntries.push(entry);
    } else if (entry.isDirectory) {
      let reader = entry.createReader();
      queue.push(...await readAllDirectoryEntries(reader));
    }
  }
  return fileEntries;
}

// Get all the entries (files or sub-directories) in a directory by calling readEntries until it returns empty array
async function readAllDirectoryEntries(directoryReader) {
  let entries = [];
  let readEntries = await readEntriesPromise(directoryReader);
  while (readEntries.length > 0) {
    entries.push(...readEntries);
    readEntries = await readEntriesPromise(directoryReader);
  }
  return entries;
}

// Wrap readEntries in a promise to make working with readEntries easier
async function readEntriesPromise(directoryReader) {
  try {
    return await new Promise((resolve, reject) => {
      directoryReader.readEntries(resolve, reject);
    });
  } catch (err) {
    console.log(err);
  }
}

var lastTarget;
// Change style when hover files
window.addEventListener('dragenter', function(ev) {
  lastTarget = ev.target;
  $('#dropzone').css({'visibility':'','opacity':1});
});

// Change style when leave hover files
window.addEventListener("dragleave", function(ev) {
  if(ev.target == lastTarget || ev.target == document) {
    $('#dropzone').css({'visibility':'hidden','opacity':0});
  }
});

// Disabled default drag and drop
function allowDrop(ev) {
  ev.preventDefault();
}

// Close file manager function
function closeFileManager() {
  // Try window.close() first
  if (window.opener && !window.opener.closed) {
    window.close();
  } else {
    // If we're in an iframe or window.close() doesn't work
    try {
      // Send message to parent if in iframe
      window.parent.postMessage('closeFileManager', '*');
    } catch (e) {
      console.error('Unable to close file manager automatically');
      // Show user message if we can't close automatically
      $('#filebrowser').empty();
      $('#filebrowser').append(
        $('<div>').text('You can now close this window').css({
          'text-align': 'center',
          'margin-top': '20px',
          'font-size': '18px'
        })
      );
    }
  }
}

// Listen for messages from parent window
window.addEventListener('message', function(event) {
  // Check if we received the reset message
  if (event.data === 'resetToDefault') {
    // Reset to the default directory (/config)
    showLoading();
    socket.emit('open', '');
  }
}, false);

// Incoming socket requests
socket.on('renderfiles', renderFiles);

// Render file list
async function renderFiles(data) {
  let dirs = data[0];
  let files = data[1];
  let directory = data[2];
  
  // Store current data globally for sorting
  currentDirs = dirs;
  currentFiles = files;
  
  let directoryClean = directory.replace("'","|");
  if (directoryClean == '/') {
    directoryClean = '';
  }
  
  let table = $('<table>').addClass('fileTable');
  let tableHeader = $('<tr>');
  
  // Create clickable headers
  let headers = [
    { name: 'Name', sortKey: 'name' },
    { name: 'Type', sortKey: null },
    { name: 'Last Modified', sortKey: 'modified' },
    { name: 'Download', sortKey: null },
    { name: 'Delete', sortKey: null }
  ];
  
  for (let header of headers) {
    let th = $('<th>').text(header.name);
    
    if (header.sortKey) {
      th.addClass('sortable').css({
        'cursor': 'pointer',
        'user-select': 'none',
        'position': 'relative'
      });
      
      // Add sort indicator
      if (currentSortColumn === header.sortKey) {
        let indicator = currentSortDirection === 'asc' ? ' ↑' : ' ↓';
        th.text(header.name + indicator);
      }
      
      th.click(function() {
        // Toggle sort direction if same column, otherwise set to ascending
        if (currentSortColumn === header.sortKey) {
          currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          currentSortColumn = header.sortKey;
          currentSortDirection = 'asc';
        }
        
        // Update header indicators
        tableHeader.find('th').each(function() {
          let headerText = $(this).text().replace(' ↑', '').replace(' ↓', '');
          $(this).text(headerText);
        });
        
        let indicator = currentSortDirection === 'asc' ? ' ↑' : ' ↓';
        $(this).text(header.name + indicator);
        
        // Re-render the table with new sort
        rerenderTable();
      });
    }
    
    tableHeader.append(th);
  }
  
  table.append(tableHeader);
  
  $('#filebrowser').empty();
  $('#filebrowser').data('directory', directory);
  
  // Add a simple header showing current directory name
  let displayName = directory === '/config' ? 'Home Directory' : directory.split('/').pop();
  $('#filebrowser').append(
    $('<div>').text(displayName).css({
      'padding': '16px 20px',
      'font-size': '18px',
      'font-weight': '600',
      'background': '#f8f9fa',
      'border-bottom': '1px solid var(--border-color)'
    })
  );
  
  $('#filebrowser').append(table);
  
  // Initial render with default sorting (alphabetical by name)
  currentSortColumn = 'name';
  currentSortDirection = 'asc';
  rerenderTable();
}
