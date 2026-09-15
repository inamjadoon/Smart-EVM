from crud_service import *


create_role("Developer")
print(get_roles())

create_user("Ali","abc",1)
print(get_users())


create_project("Test Project",5000,None,None,1)
print(get_projects())


create_sprint(1,1,"Sprint 1",None,None,200)
print(get_sprints())

create_task(1,1,"EXT123","Test task","To Do",5)
print(get_tasks())


create_metric(1,1,0,1,2,3,80,5,95)
print(get_metrics())


create_history(1,1000,900,800,1.1,1.0,95,1200,200)
print(get_history())