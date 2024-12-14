
#!/bin/bash

kill_port() {
    local port=$1
    local pid=$(lsof -t -i:$port)
    if [ ! -z "$pid" ]; then
        echo "Killing process on port $port (PID: $pid)"
        kill -9 $pid
    else
        echo "No process found on port $port"
    fi
}

# Kill common development ports
kill_port 3000
kill_port 3001 
kill_port 5000
kill_port 8000
kill_port 8080
