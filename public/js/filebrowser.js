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

// Render file list
async function renderFiles(data) {
  let dirs = data[0];
  let files = data[1];
  let directory = data[2];
  let baseName = directory.split('/').slice(-1)[0]; 
  let parentFolder = directory.replace(baseName,'');
  if (parentFolder.endsWith('/')) {
    parentFolder = parentFolder.slice(0, -1);
  }
  let directoryClean = directory.replace("'","|");
  if (directoryClean == '/') {
    directoryClean = '';
  }
  
  let table = $('<table>').addClass('fileTable');
  let tableHeader = $('<tr>');
  for await (name of ['Name', 'Type', 'Download']) {
    tableHeader.append($('<th>').text(name));
  }
  table.append(tableHeader);
  
  $('#filebrowser').empty();
  $('#filebrowser').data('directory', directory);
  
  // Add a simple header for the current directory
  let currentDirHeader = $('<div>').addClass('current-directory').css({
    'padding': '16px 20px',
    'font-size': '16px',
    'font-weight': '500',
    'background': '#f8f9fa',
    'border-bottom': '1px solid var(--border-color)',
    'display': 'flex',
    'align-items': 'center',
    'justify-content': 'space-between'
  });
  
  // Show current directory name
  let dirName = directory === '/config' ? 'Home Directory' : directory.split('/').pop();
  currentDirHeader.append($('<div>').text(dirName));
  
  // Add the header to the file browser
  $('#filebrowser').append(currentDirHeader);
  $('#filebrowser').append(table);
  
  // Add parent directory row only if not in home directory (/config)
  if (directory !== '/config') {
    let parentRow = $('<tr>');
    let parentLink = $('<td>').addClass('directory back-link')
      .attr('onclick', 'getFiles(\'' + parentFolder + '\');')
      .text('Back');
    let parentType = $('<td>').text('Parent');
    let parentDownload = $('<td>').text('-');
    for await (item of [parentLink, parentType, parentDownload]) {
      parentRow.append(item);
    }
    table.append(parentRow);
  }
  
  // Sort directories alphabetically
  dirs.sort((a, b) => a.localeCompare(b));
  
  if (dirs.length > 0) {
    for await (let dir of dirs) {
      let tableRow = $('<tr>');
      let dirClean = dir.replace("'","|");
      let link = $('<td>').addClass('directory')
        .attr('onclick', 'getFiles(\'' + directoryClean + '/' + dirClean + '\');')
        .text(dir);
      let type = $('<td>').text('Folder');
      let download = $('<td>').text('-'); // Directories can't be downloaded
      for await (item of [link, type, download]) {
        tableRow.append(item);
      }
      table.append(tableRow);
    }
  }
  
  // Sort files alphabetically
  files.sort((a, b) => a.localeCompare(b));
  
  if (files.length > 0) {
    for await (let file of files) {
      let tableRow = $('<tr>');
      let fileClean = file.replace("'","|");
      let link = $('<td>').addClass('file').text(file);
      let type = $('<td>').text('File');
      let download = $('<td>').append(
        $('<button>').addClass('download-button').text('Download')
          .click(function() {
            downloadFile(directoryClean + '/' + fileClean);
          })
      );
      for await (item of [link, type, download]) {
        tableRow.append(item);
      }
      table.append(tableRow);
    }
  }
  
  // Show empty state if no files or directories
  if (dirs.length === 0 && files.length === 0) {
    let emptyRow = $('<tr>');
    let emptyCell = $('<td>')
      .attr('colspan', '3')
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
  
  // Show downloading indicator
  $('#filebrowser').append(
    $('<div>')
      .attr('id', 'download-status')
      .text('Downloading file...')
      .css({
        'position': 'fixed',
        'bottom': '20px',
        'right': '20px',
        'background': 'var(--primary-color)',
        'color': 'white !important',
        'padding': '10px 20px',
        'border-radius': '4px',
        'box-shadow': '0 2px 10px rgba(0,0,0,0.1)',
        'z-index': '1000'
      })
  );
  
  socket.emit('downloadfile', file);
}

// Send buffer to download blob
function sendFile(res) {
  let data = res[0];
  let fileName = res[1];
  let blob = new Blob([data], { type: "application/octetstream" });
  let url = window.URL || window.webkitURL;
  link = url.createObjectURL(blob);
  let a = $("<a />");
  a.attr("download", fileName);
  a.attr("href", link);
  $("body").append(a);
  a[0].click();
  $("body").remove(a);
  
  // Remove the download status and show success
  $('#download-status').remove();
  
  let successNotice = $('<div>')
    .attr('id', 'download-success')
    .text('Download complete!')
    .css({
      'position': 'fixed',
      'bottom': '20px',
      'right': '20px',
      'background': '#4caf50',
      'color': 'white !important',
      'padding': '10px 20px',
      'border-radius': '4px',
      'box-shadow': '0 2px 10px rgba(0,0,0,0.1)',
      'z-index': '1000'
    });
  
  $('body').append(successNotice);
  
  // Remove success notice after 3 seconds
  setTimeout(function() {
    successNotice.fadeOut(function() {
      $(this).remove();
    });
  }, 3000);
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
    showLoading();
    
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
    
    for await (let file of input.files) {
      let reader = new FileReader();
      
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
      
      reader.onprogress = function(e) {
        if (e.lengthComputable) {
          let percentLoaded = Math.round((e.loaded / e.total) * 100);
          progress.css('width', percentLoaded + '%');
        }
      };
      
      reader.onload = async function(e) {
        let fileName = file.name;
        progress.css('width', '100%');
        
        if (e.total < 200000000) {
          let data = e.target.result;
          if (file == input.files[input.files.length - 1]) {
            socket.emit('uploadfile', [directory, directoryUp + '/' + fileName, data, true]);
            
            // Remove progress container after 1 second
            setTimeout(function() {
              progressContainer.fadeOut(function() {
                $(this).remove();
              });
            }, 1000);
          } else {
            socket.emit('uploadfile', [directory, directoryUp + '/' + fileName, data, false]);
          }
        } else {
          progressItem.css('color', 'red');
          fileName.text(fileName.text() + ' - File too big');
          await new Promise(resolve => setTimeout(resolve, 2000));
          socket.emit('getfiles', directory);
        }
      };
      
      reader.readAsArrayBuffer(file);
    }
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

// Incoming socket requests
socket.on('renderfiles', renderFiles);
socket.on('sendfile', sendFile);
