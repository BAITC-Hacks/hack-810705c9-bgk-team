# Grill integration assumptions

`task_id` is text and currently has no task-table foreign key because this worktree has no task entity/table. This API creates and stores the grill session and fields only; task creation and ownership checks must be joined when the task module is integrated.

Draft analysis and answer classification are integration seams: callers may provide quoted `draftFields` and a `classification` in the request. The BFF does not call a model directly. Fields without a non-empty source quote are ignored. Draft fields begin as `suggested` and the first response is the `draft` checkpoint.
