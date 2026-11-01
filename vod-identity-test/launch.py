"""Initialize only this container's dedicated /data mount, then drop privileges."""
import os
import pwd

account = pwd.getpwnam('worker')
os.chown('/data', account.pw_uid, account.pw_gid)
os.setgroups([])
os.setgid(account.pw_gid)
os.setuid(account.pw_uid)
os.execvp('node', ['node', '/app/server.cjs'])
