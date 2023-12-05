# Use an official Python runtime as a parent image
FROM python:3.9-slim-buster

# Install required packages
RUN apt-get update && \
    apt-get install -y build-essential curl git && \
    apt-get install -y libatlas-base-dev liblapack-dev libopenblas-dev gfortran && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install TA-Lib
RUN curl -L https://downloads.sourceforge.net/project/ta-lib/ta-lib/0.4.0/ta-lib-0.4.0-src.tar.gz | tar xvz && \
    cd ta-lib && \
    ./configure --prefix=/usr && \
    make && \
    make install && \
    cd .. && \
    rm -rf ta-lib

# Set the working directory to /app
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install the required packages
# Run python import talib to check if it is installed correctly
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy the rest of the application code into the container at /app
COPY . .

# Run the command to start the application
EXPOSE 8080
CMD ["python", "main.py"]