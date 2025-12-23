    let whereClause = "user_id = $1";
    const params: any[] = [auth.userID];

    if (req.status) {
      whereClause += " AND status = $2";
      params.push(req.status);
    }


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