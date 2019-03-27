#!/bin/sh

deployFunction() {
    name=$1
    ns=$RXJS_FIDDLE_NS
    version=$RXJS_FIDDLE_VERSION
    hostname=$RXJS_FIDDLE_HOST

    if [ -z $ns ]
    then
        ns="default"
    fi

    if [ -z $version ]
    then
        version="dev"
    fi

    if [ -z $hostname ]
    then
        hostname="localhost"
    fi

    if [ -z kubeless function ls $name --namespace $ns 2> /dev/null ]
    then
        kubeless function deploy "$name" --runtime nodejs8 --namespace "$ns" --handler "$name.main" --from-file "$name/$name.js" --dependencies "$name/package.json" --env "RXJS_FIDDLE_ENV=$ns,RXJS_FIDDLE_VERSION=$version"
        kubeless trigger http create "$name" --function-name "$name" --hostname "$hostname" --path "$name" --namespace "$ns" --cors-enable
    else
        kubeless function update "$name" --runtime nodejs8 --namespace "$ns" --handler "$name.main" --from-file "$name/$name.js" --dependencies "$name/package.json" --env "RXJS_FIDDLE_ENV=$ns,RXJS_FIDDLE_VERSION=$version"
        kubeless trigger http update "$name" --function-name "$name" --hostname "$hostname" --path "$name" --namespace "$ns"
    fi
}

deployFunction "echo"