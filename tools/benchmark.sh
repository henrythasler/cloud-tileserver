ENDPOINT=https://4vci3n7djxnwdhltigbeptswua0vzafy.lambda-url.eu-central-1.on.aws/
FILE=local/14/8691/5677.mvt

printf "run;response_code;http_version;size_download;time_namelookup;time_connect;time_appconnect;time_starttransfer;time_total\n"
for i in {1..50}; do 
    curl -s -w "${i};%{response_code};%{http_version};%{size_download};%{time_namelookup};%{time_connect};%{time_appconnect};%{time_starttransfer};%{time_total}\n" -o /dev/null ${ENDPOINT}${FILE}
done