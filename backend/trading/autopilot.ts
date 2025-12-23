    let whereClause = "user_id = $1";
    const params: any[] = [auth.userID];

    if (req.status) {
      whereClause += " AND status = $2";
      params.push(req.status);
    }

    // #region agent log - Hypothesis 2: Test SQL query construction before execution
    fetch('http://127.0.0.1:7245/ingest/7f0acc2c-8c83-40f0-80db-c91ba3178310',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'autopilot.ts:315',message:'SQL query construction',data:{whereClause:whereClause,paramsCount:params.length,limit:limit,offset:offset},timestamp:Date.now(),sessionId:'debug-session',runId:'hypothesis-test',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    const actions = await db.query<{
      id: string;
      action_type: string;
      status: string;
      action_data: any;
      risk_validation: any;
      created_at: string;
      executed_at?: string;
      error_message?: string;
    }>`
      SELECT id, action_type, status, action_data, risk_validation,
             created_at, executed_at, error_message
      FROM proposed_actions
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;