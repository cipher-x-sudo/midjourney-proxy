#!/bin/bash

# Set default JAVA_OPTS if not provided
# Note: Removed JMX remote options to avoid container metrics detection issues
JAVA_OPTS="${JAVA_OPTS:--XX:MaxRAMPercentage=85 -Djava.awt.headless=true -XX:+HeapDumpOnOutOfMemoryError -XX:MaxGCPauseMillis=20 -XX:InitiatingHeapOccupancyPercent=35 -Xlog:gc:file=/home/spring/logs/gc.log -Dlogging.file.path=/home/spring/logs -Dserver.port=8080 -Duser.timezone=Asia/Shanghai -XX:+UseContainerSupport -XX:+UseG1GC -XX:-UsePerfData}"

# Start the application
# The container metrics errors are non-fatal warnings and won't prevent startup
exec java $JAVA_OPTS -jar app.jar

